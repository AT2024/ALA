/**
 * Sync Service
 *
 * Handles synchronization of offline changes with the server.
 * Implements exponential backoff, retry logic, and escalation.
 *
 * Features:
 * - Automatic sync when network is restored
 * - Exponential backoff for failed syncs
 * - Escalation to manual intervention after 5 failures
 * - Progress tracking and status updates
 */

import { offlineDb, PendingChange, OfflineConflict } from './indexedDbService';
import { networkStatus } from './networkStatus';
import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface SyncProgress {
  total: number;
  synced: number;
  pending: number;
  failed: number;
  conflicts: number;
  requiresIntervention: number;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  conflicts: number;
  errors: number;
  message: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'partial';

export interface SyncListener {
  onStatusChange: (status: SyncStatus) => void;
  onProgress: (progress: SyncProgress) => void;
  onConflict: (conflict: OfflineConflict) => void;
  onError: (error: Error) => void;
  onComplete: (result: SyncResult) => void;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_RETRY_COUNT = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;
const DEVICE_ID_KEY = 'ala_deviceId';

// ============================================================================
// Device ID Helper (exported for use by other components)
// ============================================================================

/**
 * Get or create a unique device ID for offline sync
 * Persists to localStorage for consistent identification across sessions
 *
 * @returns Unique device identifier string
 */
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ============================================================================
// Sync Service Class
// ============================================================================

class SyncService {
  private status: SyncStatus = 'idle';
  private listeners: Set<Partial<SyncListener>> = new Set();
  private syncInProgress = false;
  private deviceId: string;
  private offlineSince: Date | null = null;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();

    // Subscribe to network status changes
    networkStatus.subscribe((isOnline) => {
      if (isOnline) {
        this.handleNetworkRestore();
      } else {
        this.offlineSince = new Date();
      }
    });

    // Check initial state
    if (!networkStatus.isOnline) {
      this.offlineSince = new Date();
    }
  }

  /**
   * Get or create a unique device ID (internal)
   */
  private getOrCreateDeviceId(): string {
    return getOrCreateDeviceId();
  }

  /**
   * Get the current device ID (public accessor)
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Subscribe to sync events
   */
  subscribe(listener: Partial<SyncListener>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Get current progress
   */
  async getProgress(): Promise<SyncProgress> {
    const stats = await offlineDb.getStorageStats();
    const intervention = await offlineDb.getChangesRequiringIntervention();
    const conflicts = await offlineDb.getConflicts();

    return {
      total: stats.pendingChangesCount,
      synced: 0, // Will be updated during sync
      pending: stats.pendingChangesCount - intervention.length,
      failed: intervention.length,
      conflicts: conflicts.length,
      requiresIntervention: intervention.length,
    };
  }

  /**
   * Handle network restoration - trigger auto-sync
   */
  private async handleNetworkRestore(): Promise<void> {
    console.log('[SyncService] Network restored, starting auto-sync...');

    // Wait a moment to ensure connection is stable
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (networkStatus.isOnline) {
      this.sync();
    }
  }

  /**
   * Sync all pending changes
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        synced: 0,
        conflicts: 0,
        errors: 0,
        message: 'Sync already in progress',
      };
    }

    if (!networkStatus.isOnline) {
      return {
        success: false,
        synced: 0,
        conflicts: 0,
        errors: 0,
        message: 'No network connection',
      };
    }

    this.syncInProgress = true;
    this.updateStatus('syncing');

    try {
      const pendingChanges = await offlineDb.getPendingChanges();

      if (pendingChanges.length === 0) {
        this.updateStatus('success');
        return {
          success: true,
          synced: 0,
          conflicts: 0,
          errors: 0,
          message: 'No changes to sync',
        };
      }

      // Send changes to server
      const response = await api.post('/offline/sync', {
        deviceId: this.deviceId,
        offlineSince: this.offlineSince?.toISOString() || new Date().toISOString(),
        changes: pendingChanges.map(change => ({
          id: String(change.id),
          entityType: change.entityType,
          entityId: change.entityId,
          operation: change.operation,
          data: change.data,
          localVersion: (change.data as any).version || 1,
          changedAt: change.createdAt,
          changeHash: change.changeHash,
        })),
      });

      // Process results
      let synced = 0;
      let conflicts = 0;
      let errors = 0;

      for (const result of response.data.results) {
        const change = pendingChanges.find(c => String(c.id) === result.changeId);
        if (!change) continue;

        if (result.status === 'synced') {
          await offlineDb.removePendingChange(change.id!);
          synced++;
        } else if (result.status === 'conflict') {
          // Create local conflict record
          await offlineDb.addConflict({
            entityType: change.entityType,
            entityId: change.entityId,
            localData: change.data,
            serverData: {}, // Will be fetched when viewing conflict
            conflictType: 'version_mismatch',
            createdAt: new Date().toISOString(),
            requiresAdmin: result.message?.includes('admin') || false,
          });
          await offlineDb.removePendingChange(change.id!);
          conflicts++;

          // Notify listeners
          this.notifyConflict({
            id: 0,
            entityType: change.entityType,
            entityId: change.entityId,
            localData: change.data,
            serverData: {},
            conflictType: 'version_mismatch',
            createdAt: new Date().toISOString(),
            requiresAdmin: false,
          });
        } else {
          // Handle error with retry
          await this.handleSyncError(change, new Error(result.message || 'Sync failed'));
          errors++;
        }
      }

      // Update backup count
      await offlineDb.updatePendingChangesBackup();

      // Determine final status
      if (errors > 0 && synced === 0) {
        this.updateStatus('error');
      } else if (errors > 0 || conflicts > 0) {
        this.updateStatus('partial');
      } else {
        this.updateStatus('success');
      }

      // Reset offline since on success
      if (errors === 0) {
        this.offlineSince = null;
      }

      const result: SyncResult = {
        success: errors === 0,
        synced,
        conflicts,
        errors,
        message: this.buildResultMessage(synced, conflicts, errors),
      };

      // Notify completion
      this.listeners.forEach(l => l.onComplete?.(result));

      return result;
    } catch (error) {
      console.error('[SyncService] Sync error:', error);
      this.updateStatus('error');
      this.notifyError(error as Error);

      return {
        success: false,
        synced: 0,
        conflicts: 0,
        errors: 1,
        message: 'Sync failed: ' + (error as Error).message,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Handle sync error with exponential backoff
   */
  private async handleSyncError(change: PendingChange, error: Error): Promise<void> {
    const newRetryCount = change.retryCount + 1;
    const backoffMs = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, newRetryCount),
      MAX_BACKOFF_MS
    );

    await offlineDb.updatePendingChange(change.id!, {
      retryCount: newRetryCount,
      lastError: error.message,
      nextRetryAt: new Date(Date.now() + backoffMs).toISOString(),
    });

    // Escalate after max retries
    if (newRetryCount >= MAX_RETRY_COUNT) {
      await this.escalateToManualSync(change);
    }
  }

  /**
   * Escalate failed sync to manual intervention
   */
  private async escalateToManualSync(change: PendingChange): Promise<void> {
    console.warn('[SyncService] Escalating change to manual intervention:', change.id);

    await offlineDb.updatePendingChange(change.id!, {
      status: 'requires_manual_intervention',
    });

    // Notify supervisor for patient safety critical changes
    const isCritical = change.entityType === 'applicator' &&
      ['INSERTED', 'FAULTY'].includes((change.data as any)?.status);

    if (isCritical) {
      try {
        await api.post('/incidents/sync-failure', {
          changeId: change.id,
          entityType: change.entityType,
          deviceId: this.deviceId,
          data: change.data,
        });
      } catch (e) {
        console.error('[SyncService] Failed to report sync failure incident:', e);
      }
    }

    this.notifyError(new Error(
      `Sync failed after ${MAX_RETRY_COUNT} attempts. Manual intervention required.`
    ));
  }

  /**
   * Retry a specific failed change
   */
  async retryChange(changeId: number): Promise<boolean> {
    try {
      const changes = await offlineDb.getPendingChanges();
      const change = changes.find(c => c.id === changeId);

      if (!change) {
        return false;
      }

      // Reset retry count
      await offlineDb.updatePendingChange(changeId, {
        retryCount: 0,
        status: 'pending',
        lastError: undefined,
        nextRetryAt: undefined,
      });

      // Trigger sync
      await this.sync();
      return true;
    } catch (error) {
      console.error('[SyncService] Retry error:', error);
      return false;
    }
  }

  /**
   * Cancel a pending change
   */
  async cancelChange(changeId: number): Promise<boolean> {
    try {
      await offlineDb.removePendingChange(changeId);
      await offlineDb.updatePendingChangesBackup();
      return true;
    } catch (error) {
      console.error('[SyncService] Cancel error:', error);
      return false;
    }
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(status: SyncStatus): void {
    this.status = status;
    this.listeners.forEach(l => l.onStatusChange?.(status));
  }

  /**
   * Notify listeners of a conflict
   */
  private notifyConflict(conflict: OfflineConflict): void {
    this.listeners.forEach(l => l.onConflict?.(conflict));
  }

  /**
   * Notify listeners of an error
   */
  private notifyError(error: Error): void {
    this.listeners.forEach(l => l.onError?.(error));
  }

  /**
   * Build human-readable result message
   */
  private buildResultMessage(synced: number, conflicts: number, errors: number): string {
    const parts: string[] = [];

    if (synced > 0) {
      parts.push(`${synced} change${synced !== 1 ? 's' : ''} synced`);
    }
    if (conflicts > 0) {
      parts.push(`${conflicts} conflict${conflicts !== 1 ? 's' : ''} detected`);
    }
    if (errors > 0) {
      parts.push(`${errors} error${errors !== 1 ? 's' : ''}`);
    }

    if (parts.length === 0) {
      return 'No changes to sync';
    }

    return parts.join(', ');
  }
}

// Singleton instance
export const syncService = new SyncService();

// Export class for testing
export { SyncService };
