/**
 * Test Mock Utilities for Offline Services
 *
 * Provides reusable mock factories for testing offline services.
 */

import { vi } from 'vitest';

// ============================================================================
// Network Status Mock
// ============================================================================

export interface MockNetworkStatus {
  isOnline: boolean;
  offlineStartTime: Date | null;
  lastOnline: Date | null;
  offlineDurationMs: number;
  subscribe: ReturnType<typeof vi.fn>;
  checkNetwork: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock for networkStatus service
 */
export const createNetworkStatusMock = (initialOnline = true): MockNetworkStatus => ({
  isOnline: initialOnline,
  offlineStartTime: initialOnline ? null : new Date(),
  lastOnline: initialOnline ? new Date() : null,
  offlineDurationMs: 0,
  subscribe: vi.fn(() => vi.fn()), // Returns unsubscribe function
  checkNetwork: vi.fn(() => initialOnline),
});

// ============================================================================
// API Mock
// ============================================================================

export interface MockApi {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock for the api service
 */
export const createApiMock = (): MockApi => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
});

// ============================================================================
// Clock Service Mock
// ============================================================================

export interface MockClockService {
  sync: ReturnType<typeof vi.fn>;
  getAdjustedTime: ReturnType<typeof vi.fn>;
  getAdjustedISOString: ReturnType<typeof vi.fn>;
  getAdjustedTimestamp: ReturnType<typeof vi.fn>;
  getOffset: ReturnType<typeof vi.fn>;
  isClockReliable: ReturnType<typeof vi.fn>;
  needsSync: ReturnType<typeof vi.fn>;
  getLastSyncTime: ReturnType<typeof vi.fn>;
  getStatusMessage: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock for clockService
 */
export const createClockServiceMock = (): MockClockService => ({
  sync: vi.fn().mockResolvedValue({ success: true, offset: 0, roundTrip: 50, serverTime: new Date() }),
  getAdjustedTime: vi.fn(() => new Date()),
  getAdjustedISOString: vi.fn(() => new Date().toISOString()),
  getAdjustedTimestamp: vi.fn(() => Date.now()),
  getOffset: vi.fn(() => 0),
  isClockReliable: vi.fn(() => true),
  needsSync: vi.fn(() => false),
  getLastSyncTime: vi.fn(() => new Date()),
  getStatusMessage: vi.fn(() => 'Clock synchronized'),
});

// ============================================================================
// Offline Database Mock
// ============================================================================

export interface MockOfflineDb {
  initialize: ReturnType<typeof vi.fn>;
  isEncryptionReady: ReturnType<typeof vi.fn>;
  saveTreatment: ReturnType<typeof vi.fn>;
  getTreatment: ReturnType<typeof vi.fn>;
  getTreatmentsByUser: ReturnType<typeof vi.fn>;
  getDownloadedTreatments: ReturnType<typeof vi.fn>;
  deleteTreatment: ReturnType<typeof vi.fn>;
  isTreatmentExpired: ReturnType<typeof vi.fn>;
  saveApplicator: ReturnType<typeof vi.fn>;
  saveApplicators: ReturnType<typeof vi.fn>;
  getApplicator: ReturnType<typeof vi.fn>;
  getApplicatorsByTreatment: ReturnType<typeof vi.fn>;
  getApplicatorBySerial: ReturnType<typeof vi.fn>;
  updateApplicatorStatus: ReturnType<typeof vi.fn>;
  addPendingChange: ReturnType<typeof vi.fn>;
  getPendingChanges: ReturnType<typeof vi.fn>;
  getPendingChangesCount: ReturnType<typeof vi.fn>;
  updatePendingChange: ReturnType<typeof vi.fn>;
  removePendingChange: ReturnType<typeof vi.fn>;
  getChangesRequiringIntervention: ReturnType<typeof vi.fn>;
  addConflict: ReturnType<typeof vi.fn>;
  getConflicts: ReturnType<typeof vi.fn>;
  getAdminRequiredConflicts: ReturnType<typeof vi.fn>;
  removeConflict: ReturnType<typeof vi.fn>;
  cleanupExpiredData: ReturnType<typeof vi.fn>;
  getStorageStats: ReturnType<typeof vi.fn>;
  checkDataIntegrity: ReturnType<typeof vi.fn>;
  updatePendingChangesBackup: ReturnType<typeof vi.fn>;
  clearAll: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock for offlineDb service
 */
export const createOfflineDbMock = (): MockOfflineDb => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  isEncryptionReady: vi.fn(() => true),
  saveTreatment: vi.fn().mockResolvedValue(undefined),
  getTreatment: vi.fn().mockResolvedValue(undefined),
  getTreatmentsByUser: vi.fn().mockResolvedValue([]),
  getDownloadedTreatments: vi.fn().mockResolvedValue([]),
  deleteTreatment: vi.fn().mockResolvedValue(undefined),
  isTreatmentExpired: vi.fn().mockResolvedValue(false),
  saveApplicator: vi.fn().mockResolvedValue(undefined),
  saveApplicators: vi.fn().mockResolvedValue(undefined),
  getApplicator: vi.fn().mockResolvedValue(undefined),
  getApplicatorsByTreatment: vi.fn().mockResolvedValue([]),
  getApplicatorBySerial: vi.fn().mockResolvedValue(undefined),
  updateApplicatorStatus: vi.fn().mockResolvedValue(undefined),
  addPendingChange: vi.fn().mockResolvedValue(1),
  getPendingChanges: vi.fn().mockResolvedValue([]),
  getPendingChangesCount: vi.fn().mockResolvedValue(0),
  updatePendingChange: vi.fn().mockResolvedValue(undefined),
  removePendingChange: vi.fn().mockResolvedValue(undefined),
  getChangesRequiringIntervention: vi.fn().mockResolvedValue([]),
  addConflict: vi.fn().mockResolvedValue(1),
  getConflicts: vi.fn().mockResolvedValue([]),
  getAdminRequiredConflicts: vi.fn().mockResolvedValue([]),
  removeConflict: vi.fn().mockResolvedValue(undefined),
  cleanupExpiredData: vi.fn().mockResolvedValue(0),
  getStorageStats: vi.fn().mockResolvedValue({
    treatmentCount: 0,
    applicatorCount: 0,
    pendingChangesCount: 0,
    conflictCount: 0,
    estimatedSizeBytes: 0,
  }),
  checkDataIntegrity: vi.fn().mockResolvedValue({ status: 'ok' }),
  updatePendingChangesBackup: vi.fn().mockResolvedValue(undefined),
  clearAll: vi.fn().mockResolvedValue(undefined),
  close: vi.fn(),
});

// ============================================================================
// Timer Utilities
// ============================================================================

/**
 * Advance fake timers by specified milliseconds
 */
export const advanceTimersByMs = async (ms: number): Promise<void> => {
  vi.advanceTimersByTime(ms);
  await vi.runAllTimersAsync();
};

/**
 * Set current time for fake timers
 */
export const setSystemTime = (date: Date | number): void => {
  vi.setSystemTime(date);
};
