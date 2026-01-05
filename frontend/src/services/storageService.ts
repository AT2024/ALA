/**
 * Storage Management Service
 *
 * Manages offline storage quota, cleanup, and integrity checking.
 * Provides utilities for estimating storage usage and handling quota exceeded errors.
 */

import { offlineDb } from './indexedDbService';

// ============================================================================
// Types
// ============================================================================

export interface StorageEstimate {
  used: number;           // Bytes used
  available: number;      // Bytes available
  quota: number;          // Total quota
  percentUsed: number;    // Percentage used (0-100)
}

export interface StorageStats {
  treatmentCount: number;
  applicatorCount: number;
  pendingChangesCount: number;
  conflictCount: number;
  estimatedSizeBytes: number;
  storageEstimate?: StorageEstimate;
}

export interface DataIntegrityResult {
  status: 'ok' | 'corrupted' | 'missing';
  pendingChangesLost?: number;
  message: string;
}

// ============================================================================
// Constants
// ============================================================================

// Warning threshold (80% of quota)
const STORAGE_WARNING_THRESHOLD = 0.8;

// Minimum buffer space required for writes (5MB)
const MIN_BUFFER_SPACE = 5 * 1024 * 1024;

// ============================================================================
// Storage Service Class
// ============================================================================

class StorageService {
  /**
   * Get storage estimate using Navigator Storage API
   */
  async getStorageEstimate(): Promise<StorageEstimate> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const available = quota - used;
        const percentUsed = quota > 0 ? (used / quota) * 100 : 0;

        return {
          used,
          available,
          quota,
          percentUsed,
        };
      }
    } catch (error) {
      console.warn('[StorageService] Storage estimate not available:', error);
    }

    // Fallback estimate based on typical browser limits
    return {
      used: 0,
      available: 50 * 1024 * 1024, // Assume 50MB available
      quota: 50 * 1024 * 1024,
      percentUsed: 0,
    };
  }

  /**
   * Get complete storage statistics
   */
  async getStorageStats(): Promise<StorageStats> {
    const dbStats = await offlineDb.getStorageStats();
    const storageEstimate = await this.getStorageEstimate();

    return {
      ...dbStats,
      storageEstimate,
    };
  }

  /**
   * Check if storage is running low
   */
  async isStorageLow(): Promise<boolean> {
    const estimate = await this.getStorageEstimate();
    return estimate.percentUsed >= STORAGE_WARNING_THRESHOLD * 100;
  }

  /**
   * Check if there's enough space for a write operation
   */
  async hasSpaceForWrite(estimatedSize: number): Promise<boolean> {
    const estimate = await this.getStorageEstimate();
    return estimate.available >= estimatedSize + MIN_BUFFER_SPACE;
  }

  /**
   * Safe write operation with quota handling
   *
   * @param operation - Async function to execute
   * @param estimatedSize - Estimated size of data to write
   * @returns Result of the operation
   * @throws QuotaExceededError if no space available
   */
  async safeWrite<T>(
    operation: () => Promise<T>,
    estimatedSize: number
  ): Promise<T> {
    const { available } = await this.getStorageEstimate();

    if (available < estimatedSize * 1.5) {
      // Try to free up space first
      const cleaned = await this.cleanupExpiredData();
      console.log(`[StorageService] Cleaned ${cleaned} expired items`);

      // Check again
      const { available: newAvailable } = await this.getStorageEstimate();
      if (newAvailable < estimatedSize) {
        throw new QuotaExceededError('Insufficient storage space');
      }
    }

    try {
      return await operation();
    } catch (error) {
      if (this.isQuotaError(error)) {
        // Try cleanup and retry once
        await this.cleanupExpiredData();
        return await operation();
      }
      throw error;
    }
  }

  /**
   * Check if an error is a quota exceeded error
   */
  private isQuotaError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'QuotaExceededError' ||
             error.message.includes('quota') ||
             error.message.includes('storage');
    }
    return false;
  }

  /**
   * Clean up expired offline data
   */
  async cleanupExpiredData(): Promise<number> {
    return offlineDb.cleanupExpiredData();
  }

  /**
   * Check data integrity after app startup
   */
  async checkDataIntegrity(): Promise<DataIntegrityResult> {
    try {
      const result = await offlineDb.checkDataIntegrity();

      if (result.status === 'missing' && result.pendingChangesLost) {
        return {
          ...result,
          message: `Warning: ${result.pendingChangesLost} pending changes may have been lost. This could happen if browser storage was cleared.`,
        };
      }

      if (result.status === 'corrupted') {
        return {
          ...result,
          message: 'Offline storage may be corrupted. Consider clearing and re-downloading data.',
        };
      }

      return {
        ...result,
        message: 'Data integrity check passed.',
      };
    } catch (error) {
      console.error('[StorageService] Integrity check error:', error);
      return {
        status: 'corrupted',
        message: 'Failed to check data integrity: ' + (error as Error).message,
      };
    }
  }

  /**
   * Request persistent storage (for iOS/Safari)
   */
  async requestPersistentStorage(): Promise<boolean> {
    try {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        const persisted = await navigator.storage.persisted();
        if (persisted) {
          return true;
        }

        return await navigator.storage.persist();
      }
    } catch (error) {
      console.warn('[StorageService] Persistent storage not available:', error);
    }
    return false;
  }

  /**
   * Check if storage is persistent
   */
  async isPersistentStorage(): Promise<boolean> {
    try {
      if ('storage' in navigator && 'persisted' in navigator.storage) {
        return await navigator.storage.persisted();
      }
    } catch (error) {
      console.warn('[StorageService] Cannot check persistence:', error);
    }
    return false;
  }

  /**
   * Get human-readable size string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get iOS warning message (7-day deletion risk)
   */
  getIosWarningMessage(): string {
    return `On iOS devices, offline data may be deleted by the system after 7 days of inactivity. Please sync your data regularly to prevent data loss.`;
  }

  /**
   * Check if running on iOS
   */
  isIos(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
  }

  /**
   * Clear all offline data
   */
  async clearAllData(): Promise<void> {
    await offlineDb.clearAll();
    localStorage.removeItem('ala_pendingChangesCount');
    localStorage.removeItem('ala_deviceId');
  }
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

// Singleton instance
export const storageService = new StorageService();

// Export class for testing
export { StorageService };
