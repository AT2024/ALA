/**
 * Offline Context Provider
 *
 * Provides offline state management throughout the application.
 * Handles:
 * - Network status monitoring
 * - Offline session timeout (HIPAA compliance)
 * - Downloaded treatments tracking
 * - Sync status and progress
 * - Auto-sync on reconnection
 */

import {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import { networkStatus, NetworkStatusListener } from '@/services/networkStatus';
import { offlineDb, OfflineTreatment } from '@/services/indexedDbService';
import { syncService, SyncProgress, SyncStatus, SyncResult } from '@/services/syncService';
import { storageService, StorageStats, DataIntegrityResult } from '@/services/storageService';
import { clockService } from '@/services/clockService';
import { encryptionKeyService } from '@/services/encryptionKeyService';

// ============================================================================
// Types
// ============================================================================

export interface OfflineContextType {
  // Network status
  isOnline: boolean;
  offlineDurationMs: number;

  // Session management
  sessionTimeoutAt: Date | null;
  isSessionExpired: boolean;

  // Downloaded treatments
  downloadedTreatments: OfflineTreatment[];
  isDownloaded: (treatmentId: string) => boolean;
  downloadTreatment: (treatmentId: string) => Promise<boolean>;
  removeTreatment: (treatmentId: string) => Promise<boolean>;
  refreshDownloadedTreatments: () => Promise<void>;

  // Sync status
  syncStatus: SyncStatus;
  syncProgress: SyncProgress | null;
  pendingChangesCount: number;
  conflictsCount: number;
  lastSyncResult: SyncResult | null;

  // Actions
  syncNow: () => Promise<SyncResult>;
  retryChange: (changeId: number) => Promise<boolean>;
  cancelChange: (changeId: number) => Promise<boolean>;

  // Storage
  storageStats: StorageStats | null;
  isStorageLow: boolean;
  dataIntegrity: DataIntegrityResult | null;
  refreshStorageStats: () => Promise<void>;

  // Initialization
  isInitialized: boolean;
  initializeOffline: (encryptionKey?: string) => Promise<void>;
}

// NOTE: Offline session timeout REMOVED - users can stay offline indefinitely
// Idle timeout (useIdleTimeout hook) still handles HIPAA-required inactivity logout

// ============================================================================
// Context
// ============================================================================

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export function OfflineProvider({ children }: { children: ReactNode }) {
  // Network status
  const [isOnline, setIsOnline] = useState(networkStatus.isOnline);
  const [offlineDurationMs, setOfflineDurationMs] = useState(0);

  // Session management (timeout removed - values always null/false for API compatibility)
  const [sessionTimeoutAt, _setSessionTimeoutAt] = useState<Date | null>(null);
  const [isSessionExpired, _setIsSessionExpired] = useState(false);
  // Suppress unused variable warnings (kept for backwards compatibility)
  void _setSessionTimeoutAt;
  void _setIsSessionExpired;

  // Downloaded treatments
  const [downloadedTreatments, setDownloadedTreatments] = useState<OfflineTreatment[]>([]);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [conflictsCount, setConflictsCount] = useState(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  // Storage
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isStorageLow, setIsStorageLow] = useState(false);
  const [dataIntegrity, setDataIntegrity] = useState<DataIntegrityResult | null>(null);

  // Initialization
  const [isInitialized, setIsInitialized] = useState(false);

  // ==========================================================================
  // Initialization
  // ==========================================================================

  const initializeOffline = useCallback(async (encryptionKey?: string) => {
    if (isInitialized) return;

    try {
      // Initialize IndexedDB (database only)
      await offlineDb.initializeDb();

      // Try to derive encryption key from stored credentials
      // This allows offline data to be decrypted after page refresh
      const derivedKey = await encryptionKeyService.getDerivedKey();
      if (derivedKey) {
        offlineDb.initializeEncryption(derivedKey);
        console.log('[OfflineContext] Encryption initialized from derived key');
      } else if (encryptionKey) {
        // Fallback to server-provided key (legacy support)
        await offlineDb.initialize(encryptionKey);
        console.log('[OfflineContext] Encryption initialized from server key');
      } else {
        console.log('[OfflineContext] No encryption key available - offline PHI will not be decryptable');
      }

      // Check data integrity
      const integrity = await storageService.checkDataIntegrity();
      setDataIntegrity(integrity);

      if (integrity.status !== 'ok') {
        console.warn('[OfflineContext] Data integrity issue:', integrity.message);
      }

      // Sync clock
      if (networkStatus.isOnline) {
        await clockService.sync();
      }

      // Load downloaded treatments
      const treatments = await offlineDb.getDownloadedTreatments();
      setDownloadedTreatments(treatments);

      // Get storage stats
      const stats = await storageService.getStorageStats();
      setStorageStats(stats);
      setIsStorageLow(await storageService.isStorageLow());

      // Get pending counts
      const pending = await offlineDb.getPendingChangesCount();
      setPendingChangesCount(pending);

      const conflicts = await offlineDb.getConflicts();
      setConflictsCount(conflicts.length);

      // Request persistent storage
      await storageService.requestPersistentStorage();

      setIsInitialized(true);
      console.log('[OfflineContext] Initialized successfully');
    } catch (error) {
      console.error('[OfflineContext] Initialization failed:', error);
    }
  }, [isInitialized]);

  // ==========================================================================
  // Network Status Monitoring
  // ==========================================================================

  useEffect(() => {
    const handleNetworkChange: NetworkStatusListener = (online) => {
      setIsOnline(online);
      // Session timeout removed - users can stay offline indefinitely
      // Idle timeout (useIdleTimeout hook) still handles HIPAA-required inactivity logout
    };

    const unsubscribe = networkStatus.subscribe(handleNetworkChange);

    return () => unsubscribe();
  }, []);

  // Track offline duration
  useEffect(() => {
    if (!isOnline) {
      const interval = setInterval(() => {
        setOfflineDurationMs(networkStatus.offlineDurationMs);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setOfflineDurationMs(0);
    }
  }, [isOnline]);

  // Periodic verification to catch stale network state
  useEffect(() => {
    const verifyNetworkStatus = () => {
      const actualOnline = navigator.onLine;
      if (actualOnline !== isOnline) {
        console.log('[OfflineContext] Correcting stale isOnline:', isOnline, '->', actualOnline);
        setIsOnline(actualOnline);
      }
    };

    const interval = setInterval(verifyNetworkStatus, 3000);
    return () => clearInterval(interval);
  }, [isOnline]);

  // NOTE: Session timeout handling REMOVED - users can stay offline indefinitely
  // Idle timeout (useIdleTimeout hook) still handles HIPAA-required inactivity logout

  // ==========================================================================
  // Sync Service Integration
  // ==========================================================================

  useEffect(() => {
    const unsubscribe = syncService.subscribe({
      onStatusChange: (status) => {
        setSyncStatus(status);
      },
      onProgress: (progress) => {
        setSyncProgress(progress);
        setPendingChangesCount(progress.pending);
        setConflictsCount(progress.conflicts);
      },
      onConflict: () => {
        // Refresh conflict count
        offlineDb.getConflicts().then(conflicts => {
          setConflictsCount(conflicts.length);
        });
      },
      onComplete: (result) => {
        setLastSyncResult(result);
        // Refresh pending counts
        offlineDb.getPendingChangesCount().then(setPendingChangesCount);
      },
      onError: (error) => {
        console.error('[OfflineContext] Sync error:', error);
      },
    });

    return () => unsubscribe();
  }, []);

  // ==========================================================================
  // Treatment Management
  // ==========================================================================

  const isDownloaded = useCallback((treatmentId: string): boolean => {
    return downloadedTreatments.some(t => t.id === treatmentId);
  }, [downloadedTreatments]);

  const refreshDownloadedTreatments = useCallback(async () => {
    const treatments = await offlineDb.getDownloadedTreatments();
    setDownloadedTreatments(treatments);
  }, []);

  const downloadTreatment = useCallback(async (treatmentId: string): Promise<boolean> => {
    // This will be implemented to call the download bundle API
    // For now, just return false
    console.log('[OfflineContext] Download treatment not yet implemented:', treatmentId);
    return false;
  }, []);

  const removeTreatment = useCallback(async (treatmentId: string): Promise<boolean> => {
    try {
      await offlineDb.deleteTreatment(treatmentId);
      await refreshDownloadedTreatments();
      await refreshStorageStats();
      return true;
    } catch (error) {
      console.error('[OfflineContext] Remove treatment failed:', error);
      return false;
    }
  }, [refreshDownloadedTreatments]);

  // ==========================================================================
  // Sync Actions
  // ==========================================================================

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    return syncService.sync();
  }, []);

  const retryChange = useCallback(async (changeId: number): Promise<boolean> => {
    return syncService.retryChange(changeId);
  }, []);

  const cancelChange = useCallback(async (changeId: number): Promise<boolean> => {
    const result = await syncService.cancelChange(changeId);
    if (result) {
      const pending = await offlineDb.getPendingChangesCount();
      setPendingChangesCount(pending);
    }
    return result;
  }, []);

  // ==========================================================================
  // Storage Management
  // ==========================================================================

  const refreshStorageStats = useCallback(async () => {
    const stats = await storageService.getStorageStats();
    setStorageStats(stats);
    setIsStorageLow(await storageService.isStorageLow());
  }, []);

  // ==========================================================================
  // Context Value
  // ==========================================================================

  const value = useMemo<OfflineContextType>(() => ({
    // Network status
    isOnline,
    offlineDurationMs,

    // Session management
    sessionTimeoutAt,
    isSessionExpired,

    // Downloaded treatments
    downloadedTreatments,
    isDownloaded,
    downloadTreatment,
    removeTreatment,
    refreshDownloadedTreatments,

    // Sync status
    syncStatus,
    syncProgress,
    pendingChangesCount,
    conflictsCount,
    lastSyncResult,

    // Actions
    syncNow,
    retryChange,
    cancelChange,

    // Storage
    storageStats,
    isStorageLow,
    dataIntegrity,
    refreshStorageStats,

    // Initialization
    isInitialized,
    initializeOffline,
  }), [
    isOnline,
    offlineDurationMs,
    sessionTimeoutAt,
    isSessionExpired,
    downloadedTreatments,
    isDownloaded,
    downloadTreatment,
    removeTreatment,
    refreshDownloadedTreatments,
    syncStatus,
    syncProgress,
    pendingChangesCount,
    conflictsCount,
    lastSyncResult,
    syncNow,
    retryChange,
    cancelChange,
    storageStats,
    isStorageLow,
    dataIntegrity,
    refreshStorageStats,
    isInitialized,
    initializeOffline,
  ]);

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to check if offline features are available
 */
export function useOfflineAvailable(): boolean {
  const { isInitialized } = useOffline();
  return isInitialized && 'indexedDB' in window;
}

/**
 * Hook to get formatted offline duration
 */
export function useOfflineDuration(): string {
  const { offlineDurationMs, isOnline } = useOffline();

  if (isOnline) return '';

  const minutes = Math.floor(offlineDurationMs / 60000);
  const seconds = Math.floor((offlineDurationMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s offline`;
  }
  return `${seconds}s offline`;
}
