/**
 * Offline Validation Service Unit Tests
 *
 * Tests for the offline validation service that ensures patient safety
 * by restricting certain operations while offline.
 *
 * Target: 100% code coverage
 *
 * SAFETY-CRITICAL TESTS:
 * - All ALLOWED_OFFLINE_TRANSITIONS paths
 * - Terminal status blocking
 * - Finalization always blocked
 * - Expired treatment scan blocking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { APPLICATOR_STATUSES } from '../../../../shared/applicatorStatuses';
import { createOfflineDbMock } from './helpers/testMocks';
import {
  createMockTreatment,
  createMockApplicator,
  createExpiredTreatment,
} from './helpers/indexedDbFixtures';

// ============================================================================
// Mocks
// ============================================================================

const mockOfflineDb = createOfflineDbMock();

vi.mock('../../../src/services/indexedDbService', () => ({
  offlineDb: mockOfflineDb,
}));

// ============================================================================
// Test Setup
// ============================================================================

let offlineValidationService: typeof import('../../../src/services/offlineValidationService');

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();

  // Reset mock implementations
  mockOfflineDb.getTreatment.mockResolvedValue(undefined);
  mockOfflineDb.getApplicatorBySerial.mockResolvedValue(undefined);
  mockOfflineDb.isTreatmentExpired.mockResolvedValue(false);

  // Re-import for fresh module
  offlineValidationService = await import('../../../src/services/offlineValidationService');
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// isValidOfflineStatusTransition Tests - Valid Transitions
// ============================================================================

describe('isValidOfflineStatusTransition', () => {
  describe('Valid Transitions', () => {
    it('null → OPENED should be allowed (null treated as SEALED, SEALED → OPENED is valid)', () => {
      // Implementation treats null as implicitly SEALED
      // SEALED → OPENED is a valid transition in all treatment types
      const result = offlineValidationService.isValidOfflineStatusTransition(
        null,
        APPLICATOR_STATUSES.OPENED
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
      expect(result.warningLevel).toBe('none');
    });

    it('SEALED → OPENED should be allowed without confirmation', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.SEALED,
        APPLICATOR_STATUSES.OPENED
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('OPENED → LOADED should be allowed without confirmation', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.OPENED,
        APPLICATOR_STATUSES.LOADED
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('OPENED → FAULTY should be allowed WITH confirmation', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.OPENED,
        APPLICATOR_STATUSES.FAULTY
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.warningLevel).toBe('warning');
      expect(result.message).toContain('confirmation');
    });

    it('OPENED → DISPOSED should be allowed without confirmation', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.OPENED,
        APPLICATOR_STATUSES.DISPOSED
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('LOADED → INSERTED should be allowed WITH confirmation', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.LOADED,
        APPLICATOR_STATUSES.INSERTED
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
      expect(result.warningLevel).toBe('warning');
    });

    it('LOADED → FAULTY should be allowed WITH confirmation', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.LOADED,
        APPLICATOR_STATUSES.FAULTY
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('LOADED → DEPLOYMENT_FAILURE should be allowed without confirmation', () => {
      // In GENERIC_TRANSITIONS, LOADED can go to INSERTED, FAULTY, or DEPLOYMENT_FAILURE
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.LOADED,
        APPLICATOR_STATUSES.DEPLOYMENT_FAILURE
      );

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });
  });

  // ============================================================================
  // isValidOfflineStatusTransition Tests - Invalid Transitions
  // ============================================================================

  describe('Invalid Transitions', () => {
    it('SEALED → LOADED should NOT be allowed (skips OPENED)', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.SEALED,
        APPLICATOR_STATUSES.LOADED
      );

      expect(result.allowed).toBe(false);
      expect(result.warningLevel).toBe('error');
      expect(result.message).toContain('is not allowed');
    });

    it('SEALED → INSERTED should NOT be allowed', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.SEALED,
        APPLICATOR_STATUSES.INSERTED
      );

      expect(result.allowed).toBe(false);
    });

    it('OPENED → INSERTED should NOT be allowed (skips LOADED)', () => {
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.OPENED,
        APPLICATOR_STATUSES.INSERTED
      );

      expect(result.allowed).toBe(false);
    });

    it('INSERTED → any should NOT be allowed (terminal status) in panc_pros', () => {
      // Using panc_pros treatment type where INSERTED is truly terminal
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.INSERTED,
        APPLICATOR_STATUSES.DISPOSED,
        'panc_pros'
      );

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('terminal status');
    });

    it('FAULTY → any should NOT be allowed (terminal status) in panc_pros', () => {
      // Using panc_pros treatment type where FAULTY is truly terminal
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.FAULTY,
        APPLICATOR_STATUSES.DISPOSED,
        'panc_pros'
      );

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('terminal status');
    });

    it('DISPOSED → any should NOT be allowed (terminal status) in panc_pros', () => {
      // Using panc_pros treatment type where DISPOSED is truly terminal
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.DISPOSED,
        APPLICATOR_STATUSES.FAULTY,
        'panc_pros'
      );

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('terminal status');
    });

    it('DISCHARGED → any should NOT be allowed (terminal status) in panc_pros', () => {
      // Using panc_pros treatment type where DISCHARGED is truly terminal
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.DISCHARGED,
        APPLICATOR_STATUSES.DISPOSED,
        'panc_pros'
      );

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('terminal status');
    });

    it('DEPLOYMENT_FAILURE → any should NOT be allowed (terminal status) in panc_pros', () => {
      // Using panc_pros treatment type where DEPLOYMENT_FAILURE is truly terminal
      const result = offlineValidationService.isValidOfflineStatusTransition(
        APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
        APPLICATOR_STATUSES.DISPOSED,
        'panc_pros'
      );

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('terminal status');
    });

    it('should use empty array fallback for unknown status key', () => {
      // Test with a status that has no transitions defined
      const result = offlineValidationService.isValidOfflineStatusTransition(
        'UNKNOWN_STATUS' as any,
        APPLICATOR_STATUSES.OPENED
      );

      expect(result.allowed).toBe(false);
    });
  });
});

// ============================================================================
// validateOfflineScan Tests
// ============================================================================

describe('validateOfflineScan', () => {
  it('should block scan if applicator not in offline storage', async () => {
    mockOfflineDb.getApplicatorBySerial.mockResolvedValue(undefined);

    const result = await offlineValidationService.validateOfflineScan(
      'UNKNOWN-SERIAL',
      'treatment-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('not downloaded');
    expect(result.warningLevel).toBe('error');
  });

  it('should block scan if applicator from different treatment', async () => {
    const applicator = createMockApplicator({
      treatmentId: 'other-treatment',
    });
    mockOfflineDb.getApplicatorBySerial.mockResolvedValue(applicator);

    const result = await offlineValidationService.validateOfflineScan(
      applicator.serialNumber,
      'treatment-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('different treatment');
  });

  it('should block scan if treatment not found', async () => {
    const applicator = createMockApplicator({ treatmentId: 'treatment-1' });
    mockOfflineDb.getApplicatorBySerial.mockResolvedValue(applicator);
    mockOfflineDb.getTreatment.mockResolvedValue(undefined);

    const result = await offlineValidationService.validateOfflineScan(
      applicator.serialNumber,
      'treatment-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should block scan if treatment expired', async () => {
    const applicator = createMockApplicator({ treatmentId: 'treatment-1' });
    const treatment = createExpiredTreatment({ id: 'treatment-1' });

    mockOfflineDb.getApplicatorBySerial.mockResolvedValue(applicator);
    mockOfflineDb.getTreatment.mockResolvedValue(treatment);
    mockOfflineDb.isTreatmentExpired.mockResolvedValue(true);

    const result = await offlineValidationService.validateOfflineScan(
      applicator.serialNumber,
      'treatment-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('expired');
    expect(result.message).toContain('Expired:');
  });

  it('should allow valid scan', async () => {
    const applicator = createMockApplicator({ treatmentId: 'treatment-1' });
    const treatment = createMockTreatment({ id: 'treatment-1' });

    mockOfflineDb.getApplicatorBySerial.mockResolvedValue(applicator);
    mockOfflineDb.getTreatment.mockResolvedValue(treatment);
    mockOfflineDb.isTreatmentExpired.mockResolvedValue(false);

    const result = await offlineValidationService.validateOfflineScan(
      applicator.serialNumber,
      'treatment-1'
    );

    expect(result.allowed).toBe(true);
    expect(result.warningLevel).toBe('none');
  });

  it('should return correct error messages', async () => {
    mockOfflineDb.getApplicatorBySerial.mockResolvedValue(undefined);

    const result = await offlineValidationService.validateOfflineScan(
      'SERIAL-123',
      'treatment-1'
    );

    expect(result.message).toContain('pre-downloaded applicators');
  });

  it('should return correct warningLevel for errors', async () => {
    mockOfflineDb.getApplicatorBySerial.mockResolvedValue(undefined);

    const result = await offlineValidationService.validateOfflineScan(
      'SERIAL-123',
      'treatment-1'
    );

    expect(result.warningLevel).toBe('error');
    expect(result.requiresConfirmation).toBe(false);
  });
});

// ============================================================================
// validateOfflineFinalization Tests
// ============================================================================

describe('validateOfflineFinalization', () => {
  it('should ALWAYS return allowed: false', () => {
    const result = offlineValidationService.validateOfflineFinalization();

    expect(result.allowed).toBe(false);
  });

  it('should return message about signature verification', () => {
    const result = offlineValidationService.validateOfflineFinalization();

    expect(result.message).toContain('signature verification');
    expect(result.message).toContain('network connection');
    expect(result.warningLevel).toBe('error');
  });
});

// ============================================================================
// isTreatmentAvailableOffline Tests
// ============================================================================

describe('isTreatmentAvailableOffline', () => {
  it('should return false if treatment not in DB', async () => {
    mockOfflineDb.getTreatment.mockResolvedValue(undefined);

    const result = await offlineValidationService.isTreatmentAvailableOffline('unknown-id');

    expect(result).toBe(false);
  });

  it('should return false if treatment expired', async () => {
    const treatment = createExpiredTreatment();
    mockOfflineDb.getTreatment.mockResolvedValue(treatment);
    mockOfflineDb.isTreatmentExpired.mockResolvedValue(true);

    const result = await offlineValidationService.isTreatmentAvailableOffline(treatment.id);

    expect(result).toBe(false);
  });

  it('should return true if exists and not expired', async () => {
    const treatment = createMockTreatment();
    mockOfflineDb.getTreatment.mockResolvedValue(treatment);
    mockOfflineDb.isTreatmentExpired.mockResolvedValue(false);

    const result = await offlineValidationService.isTreatmentAvailableOffline(treatment.id);

    expect(result).toBe(true);
  });
});

// ============================================================================
// getOfflineLimitations & getOfflineRestrictionsMessage Tests
// ============================================================================

describe('getOfflineLimitations', () => {
  it('should return maxStatusTransition as INSERTED', () => {
    const limitations = offlineValidationService.getOfflineLimitations();

    expect(limitations.maxStatusTransition).toBe(APPLICATOR_STATUSES.INSERTED);
  });

  it('should return canFinalize as false', () => {
    const limitations = offlineValidationService.getOfflineLimitations();

    expect(limitations.canFinalize).toBe(false);
  });

  it('should return INSERTED and FAULTY in requiresConfirmationFor', () => {
    const limitations = offlineValidationService.getOfflineLimitations();

    expect(limitations.requiresConfirmationFor).toContain(APPLICATOR_STATUSES.INSERTED);
    expect(limitations.requiresConfirmationFor).toContain(APPLICATOR_STATUSES.FAULTY);
  });
});

describe('getOfflineRestrictionsMessage', () => {
  it('should return formatted restrictions message', () => {
    const message = offlineValidationService.getOfflineRestrictionsMessage();

    expect(message).toContain('While offline, you can');
    expect(message).toContain('While offline, you CANNOT');
    expect(message).toContain('Finalize treatments');
    expect(message).toContain('synced when you reconnect');
  });
});

// ============================================================================
// validateOfflineComment Tests
// ============================================================================

describe('validateOfflineComment', () => {
  it('should reject empty comment', () => {
    const result = offlineValidationService.validateOfflineComment('');

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('cannot be empty');
    expect(result.warningLevel).toBe('error');
  });

  it('should reject whitespace-only comment', () => {
    const result = offlineValidationService.validateOfflineComment('   ');

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('cannot be empty');
  });

  it('should reject comment > 1000 characters', () => {
    const longComment = 'a'.repeat(1001);
    const result = offlineValidationService.validateOfflineComment(longComment);

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('too long');
    expect(result.message).toContain('1000');
  });

  it('should accept comment exactly 1000 chars', () => {
    const exactComment = 'a'.repeat(1000);
    const result = offlineValidationService.validateOfflineComment(exactComment);

    expect(result.allowed).toBe(true);
  });

  it('should accept valid comment with info warning', () => {
    const result = offlineValidationService.validateOfflineComment('Valid comment');

    expect(result.allowed).toBe(true);
    expect(result.requiresConfirmation).toBe(false);
    expect(result.warningLevel).toBe('info');
    expect(result.message).toContain('synced');
  });
});

// ============================================================================
// checkBundleExpiry Tests
// ============================================================================

describe('checkBundleExpiry', () => {
  it('should detect expired bundle (hoursRemaining <= 0)', () => {
    const expiredDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    const result = offlineValidationService.checkBundleExpiry(expiredDate.toISOString());

    expect(result.expired).toBe(true);
    expect(result.expiringS).toBe(false);
    expect(result.hoursRemaining).toBe(0);
    expect(result.message).toContain('expired');
  });

  it('should detect expiring soon (within threshold)', () => {
    const expiringDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const result = offlineValidationService.checkBundleExpiry(expiringDate.toISOString(), 2);

    expect(result.expired).toBe(false);
    expect(result.expiringS).toBe(true);
    expect(result.hoursRemaining).toBeGreaterThan(0);
    expect(result.hoursRemaining).toBeLessThanOrEqual(2);
    expect(result.message).toContain('expires in');
    expect(result.message).toContain('minutes');
  });

  it('should show valid status (not expiring)', () => {
    const validDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const result = offlineValidationService.checkBundleExpiry(validDate.toISOString());

    expect(result.expired).toBe(false);
    expect(result.expiringS).toBe(false);
    expect(result.hoursRemaining).toBeGreaterThan(2);
    expect(result.message).toBe('');
  });

  it('should respect custom warningThresholdHours', () => {
    const expiringDate = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now

    // With default threshold (2 hours), should NOT be expiring
    const result1 = offlineValidationService.checkBundleExpiry(expiringDate.toISOString(), 2);
    expect(result1.expiringS).toBe(false);

    // With higher threshold (10 hours), SHOULD be expiring
    const result2 = offlineValidationService.checkBundleExpiry(expiringDate.toISOString(), 10);
    expect(result2.expiringS).toBe(true);
  });

  it('should handle Date object input', () => {
    const validDate = new Date(Date.now() + 10 * 60 * 60 * 1000);

    const result = offlineValidationService.checkBundleExpiry(validDate);

    expect(result.expired).toBe(false);
    expect(result.hoursRemaining).toBeGreaterThan(9);
  });
});

// ============================================================================
// Constants Export Tests
// ============================================================================

describe('Exported Constants', () => {
  it('should export CONFIRMATION_REQUIRED_STATUSES', () => {
    const { CONFIRMATION_REQUIRED_STATUSES } = offlineValidationService;

    expect(CONFIRMATION_REQUIRED_STATUSES).toContain(APPLICATOR_STATUSES.INSERTED);
    expect(CONFIRMATION_REQUIRED_STATUSES).toContain(APPLICATOR_STATUSES.FAULTY);
  });

  // ALLOWED_OFFLINE_TRANSITIONS is no longer exported - implementation now uses
  // treatment-type-specific transitions (PANC_PROS_TRANSITIONS, SKIN_TRANSITIONS, GENERIC_TRANSITIONS)

  it('should export DEFAULT_EXPIRY_HOURS', () => {
    const { DEFAULT_EXPIRY_HOURS } = offlineValidationService;

    expect(DEFAULT_EXPIRY_HOURS).toBe(24);
  });
});

// ============================================================================
// Safety-Critical Tests Summary
// ============================================================================

describe('SAFETY-CRITICAL: Finalization Always Blocked', () => {
  it('CRITICAL: validateOfflineFinalization must ALWAYS return allowed: false', () => {
    // This test is critical for patient safety
    // Finalization requires digital signature verification which needs network

    for (let i = 0; i < 10; i++) {
      const result = offlineValidationService.validateOfflineFinalization();
      expect(result.allowed).toBe(false);
    }
  });
});

describe('SAFETY-CRITICAL: Terminal Status Blocking (panc_pros)', () => {
  // Testing with panc_pros treatment type where all terminal statuses are truly terminal
  // In GENERIC_TRANSITIONS, some "terminal" statuses can transition (INSERTED, FAULTY, DEPLOYMENT_FAILURE)
  // but in PANC_PROS_TRANSITIONS, these are truly blocked
  const terminalStatuses = [
    APPLICATOR_STATUSES.INSERTED,
    APPLICATOR_STATUSES.FAULTY,
    APPLICATOR_STATUSES.DISPOSED,
    APPLICATOR_STATUSES.DISCHARGED,
    APPLICATOR_STATUSES.DEPLOYMENT_FAILURE,
  ];

  const allStatuses = Object.values(APPLICATOR_STATUSES);

  terminalStatuses.forEach((terminalStatus) => {
    it(`CRITICAL: ${terminalStatus} cannot transition to any other status (panc_pros)`, () => {
      allStatuses.forEach((targetStatus) => {
        const result = offlineValidationService.isValidOfflineStatusTransition(
          terminalStatus,
          targetStatus,
          'panc_pros'
        );

        // Same status transitions are allowed as no-ops
        if (terminalStatus === targetStatus) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
        }
      });
    });
  });
});
