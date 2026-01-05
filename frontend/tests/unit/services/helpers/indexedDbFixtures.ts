/**
 * IndexedDB Test Fixtures for Offline Services
 *
 * Provides reusable test data factories for testing indexedDbService
 * and offlineValidationService.
 */

import { APPLICATOR_STATUSES, ApplicatorStatus } from '../../../../../shared/applicatorStatuses';

// ============================================================================
// Treatment Fixtures
// ============================================================================

export interface MockTreatment {
  id: string;
  type: 'insertion' | 'removal';
  subjectId: string;
  patientName?: string;
  site: string;
  date: string;
  isComplete: boolean;
  userId: string;
  surgeon?: string;
  seedQuantity?: number;
  activityPerSeed?: number;
  version: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  downloadedAt: string;
  expiresAt: string;
  serverVersion: number;
}

let treatmentCounter = 0;

/**
 * Create a mock treatment for testing
 * Matches the OfflineTreatment interface from indexedDbService
 */
export const createMockTreatment = (overrides: Partial<MockTreatment> = {}): MockTreatment => {
  treatmentCounter++;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  return {
    id: `treatment-${treatmentCounter}`,
    type: 'insertion',
    subjectId: `SUBJ-${treatmentCounter}`,
    patientName: `Test Patient ${treatmentCounter}`,
    site: 'Site A',
    date: now.toISOString(),
    isComplete: false,
    userId: 'test-user',
    surgeon: `Dr. Surgeon ${treatmentCounter}`,
    seedQuantity: 5,
    activityPerSeed: 0.5,
    version: 1,
    syncStatus: 'synced',
    downloadedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    serverVersion: 1,
    ...overrides,
  };
};

/**
 * Create an expired treatment
 */
export const createExpiredTreatment = (overrides: Partial<MockTreatment> = {}): MockTreatment => {
  const now = new Date();
  const expiredAt = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

  return createMockTreatment({
    expiresAt: expiredAt.toISOString(),
    ...overrides,
  });
};

/**
 * Create a treatment expiring soon
 */
export const createExpiringSoonTreatment = (hoursUntilExpiry: number = 1): MockTreatment => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + hoursUntilExpiry * 60 * 60 * 1000);

  return createMockTreatment({
    expiresAt: expiresAt.toISOString(),
  });
};

// ============================================================================
// Applicator Fixtures
// ============================================================================

export interface MockApplicator {
  id: string;
  treatmentId: string;
  serialNumber: string;
  catalogNumber: string;
  lotNumber: string;
  expirationDate: string;
  status: ApplicatorStatus | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  comments: string;
  position: number;
  version: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
  lastSyncedAt: string | null;
}

let applicatorCounter = 0;

/**
 * Create a mock applicator for testing
 */
export const createMockApplicator = (overrides: Partial<MockApplicator> = {}): MockApplicator => {
  applicatorCounter++;
  const now = new Date();
  const expirationDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now

  return {
    id: `applicator-${applicatorCounter}`,
    treatmentId: 'treatment-1',
    serialNumber: `SN-${applicatorCounter.toString().padStart(6, '0')}`,
    catalogNumber: `CAT-${applicatorCounter}`,
    lotNumber: `LOT-${applicatorCounter}`,
    expirationDate: expirationDate.toISOString(),
    status: null,
    statusChangedAt: null,
    statusChangedBy: null,
    comments: '',
    position: applicatorCounter,
    version: 1,
    syncStatus: 'synced',
    lastSyncedAt: now.toISOString(),
    ...overrides,
  };
};

/**
 * Create an applicator with a specific status
 */
export const createApplicatorWithStatus = (
  status: ApplicatorStatus,
  overrides: Partial<MockApplicator> = {}
): MockApplicator => {
  const now = new Date();
  return createMockApplicator({
    status,
    statusChangedAt: now.toISOString(),
    statusChangedBy: 'test-user',
    ...overrides,
  });
};

/**
 * Create a set of applicators for a treatment
 */
export const createApplicatorSet = (
  treatmentId: string,
  count: number = 5
): MockApplicator[] => {
  return Array.from({ length: count }, (_, index) =>
    createMockApplicator({
      treatmentId,
      position: index + 1,
    })
  );
};

/**
 * Create applicators in various states for workflow testing
 */
export const createWorkflowApplicators = (treatmentId: string): MockApplicator[] => {
  return [
    createMockApplicator({ treatmentId, status: null, position: 1 }),
    createApplicatorWithStatus(APPLICATOR_STATUSES.SEALED, { treatmentId, position: 2 }),
    createApplicatorWithStatus(APPLICATOR_STATUSES.OPENED, { treatmentId, position: 3 }),
    createApplicatorWithStatus(APPLICATOR_STATUSES.LOADED, { treatmentId, position: 4 }),
    createApplicatorWithStatus(APPLICATOR_STATUSES.INSERTED, { treatmentId, position: 5 }),
  ];
};

// ============================================================================
// Pending Change Fixtures
// ============================================================================

export interface MockPendingChange {
  id?: number;
  entityType: 'applicator' | 'treatment' | 'comment';
  entityId: string;
  changeType: 'status_change' | 'comment_add' | 'comment_update';
  previousValue: string | null;
  newValue: string;
  createdAt: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  status: 'pending' | 'syncing' | 'failed' | 'requires_intervention';
  metadata: Record<string, unknown>;
}

let pendingChangeCounter = 0;

/**
 * Create a mock pending change
 */
export const createMockPendingChange = (
  overrides: Partial<MockPendingChange> = {}
): MockPendingChange => {
  pendingChangeCounter++;
  const now = new Date();

  return {
    entityType: 'applicator',
    entityId: `applicator-${pendingChangeCounter}`,
    changeType: 'status_change',
    previousValue: null,
    newValue: APPLICATOR_STATUSES.SEALED,
    createdAt: now.toISOString(),
    attemptCount: 0,
    lastAttemptAt: null,
    lastError: null,
    status: 'pending',
    metadata: {},
    ...overrides,
  };
};

/**
 * Create a failed pending change
 */
export const createFailedPendingChange = (
  error: string = 'Network error',
  attemptCount: number = 3
): MockPendingChange => {
  const now = new Date();

  return createMockPendingChange({
    attemptCount,
    lastAttemptAt: now.toISOString(),
    lastError: error,
    status: 'failed',
  });
};

/**
 * Create a pending change requiring intervention
 */
export const createInterventionRequiredChange = (): MockPendingChange => {
  return createMockPendingChange({
    attemptCount: 5,
    lastError: 'Conflict detected',
    status: 'requires_intervention',
  });
};

// ============================================================================
// Conflict Fixtures
// ============================================================================

export interface MockConflict {
  id?: number;
  entityType: 'applicator' | 'treatment';
  entityId: string;
  localValue: string;
  serverValue: string;
  conflictType: 'concurrent_update' | 'stale_version' | 'deleted_on_server';
  detectedAt: string;
  requiresAdmin: boolean;
  resolution: 'pending' | 'use_local' | 'use_server' | 'merged';
  resolvedAt: string | null;
  resolvedBy: string | null;
}

let conflictCounter = 0;

/**
 * Create a mock conflict
 */
export const createMockConflict = (overrides: Partial<MockConflict> = {}): MockConflict => {
  conflictCounter++;
  const now = new Date();

  return {
    entityType: 'applicator',
    entityId: `applicator-${conflictCounter}`,
    localValue: APPLICATOR_STATUSES.LOADED,
    serverValue: APPLICATOR_STATUSES.INSERTED,
    conflictType: 'concurrent_update',
    detectedAt: now.toISOString(),
    requiresAdmin: false,
    resolution: 'pending',
    resolvedAt: null,
    resolvedBy: null,
    ...overrides,
  };
};

/**
 * Create an admin-required conflict
 */
export const createAdminConflict = (): MockConflict => {
  return createMockConflict({
    conflictType: 'stale_version',
    requiresAdmin: true,
  });
};

// ============================================================================
// Reset Functions (for test isolation)
// ============================================================================

/**
 * Reset all counters for test isolation
 */
export const resetFixtureCounters = (): void => {
  treatmentCounter = 0;
  applicatorCounter = 0;
  pendingChangeCounter = 0;
  conflictCounter = 0;
};

// ============================================================================
// PHI Field Test Data
// ============================================================================

/**
 * Sample PHI data for encryption testing
 */
export const PHI_TEST_DATA = {
  patientName: 'John Doe',
  subjectId: 'SUBJ-12345',
  surgeon: 'Dr. Jane Smith',
  serialNumber: 'SN-000001',
  comments: 'Patient tolerated procedure well',
  notes: 'Follow-up scheduled in 2 weeks',
};

/**
 * Unicode PHI data for encryption edge case testing
 */
export const UNICODE_PHI_TEST_DATA = {
  patientName: 'יוסי כהן', // Hebrew
  subjectId: 'מזהה-12345',
  surgeon: 'ד״ר מרים לוי',
  serialNumber: 'SN-000002',
  comments: 'הערות בעברית',
  notes: 'הערות נוספות',
};

/**
 * Long PHI data for testing boundary conditions
 */
export const LONG_PHI_TEST_DATA = {
  patientName: 'A'.repeat(200),
  subjectId: 'B'.repeat(100),
  surgeon: 'C'.repeat(150),
  serialNumber: 'SN-' + 'D'.repeat(50),
  comments: 'E'.repeat(1000),
  notes: 'F'.repeat(500),
};
