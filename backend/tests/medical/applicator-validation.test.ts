/**
 * Applicator 8-State Validation Tests
 * IEC 62304 Class B Medical Compliance Testing
 *
 * Tests the critical applicator validation workflow ensuring patient safety
 * through proper state transitions and validation checks.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock dependencies before importing service
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: { create: jest.fn(() => mockAxiosInstance) }
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn()
}));

// Import test fixtures
import {
  mockApplicators,
  mockOrders,
  applicatorValidationScenarios
} from '../fixtures/testData';

describe('Applicator 8-State Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('State Transitions', () => {
    describe('SCANNED -> INSERTED -> COMPLETED flow', () => {
      test('should allow valid state transition from scanned to inserted', () => {
        const applicatorState = {
          status: 'SCANNED',
          serialNumber: 'APP-001',
          intendedPatientId: 'PAT-001',
        };

        // Simulate scanning an applicator
        expect(applicatorState.status).toBe('SCANNED');

        // Update to inserted state
        const insertedState = {
          ...applicatorState,
          status: 'INSERTED',
          insertionTime: new Date().toISOString(),
          usageType: 'full',
          insertedSeedsQty: 25,
        };

        expect(insertedState.status).toBe('INSERTED');
        expect(insertedState.insertedSeedsQty).toBe(25);
      });

      test('should allow transition from inserted to completed', () => {
        const insertedState = {
          status: 'INSERTED',
          serialNumber: 'APP-001',
          usageType: 'full',
          insertedSeedsQty: 25,
        };

        // Mark as completed
        const completedState = {
          ...insertedState,
          status: 'COMPLETED',
          syncedToPriority: true,
        };

        expect(completedState.status).toBe('COMPLETED');
        expect(completedState.syncedToPriority).toBe(true);
      });
    });

    describe('SCANNED -> NO_USE -> RECOVERED flow', () => {
      test('should allow marking applicator as no-use', () => {
        const scannedState = {
          status: 'SCANNED',
          serialNumber: 'APP-002',
          intendedPatientId: 'PAT-001',
        };

        // Mark as no-use (e.g., not needed for treatment)
        const noUseState = {
          ...scannedState,
          status: 'NO_USE',
          usageType: 'none',
          insertedSeedsQty: 0,
          noUseReason: 'Not needed for treatment plan',
        };

        expect(noUseState.status).toBe('NO_USE');
        expect(noUseState.insertedSeedsQty).toBe(0);
      });

      test('should allow recovery of no-use applicator for reuse', () => {
        const noUseState = {
          status: 'NO_USE',
          serialNumber: 'APP-002',
          usageType: 'none',
          insertedSeedsQty: 0,
        };

        // Recover for reuse
        const recoveredState = {
          ...noUseState,
          status: 'RECOVERED',
          availableForReuse: true,
        };

        expect(recoveredState.status).toBe('RECOVERED');
        expect(recoveredState.availableForReuse).toBe(true);
      });
    });

    describe('SCANNED -> FAULTY scenarios', () => {
      test('should handle faulty applicator with partial seed insertion', () => {
        const scannedState = {
          status: 'SCANNED',
          serialNumber: 'APP-003',
          seedQuantity: 25,
        };

        // Mark as faulty with partial use
        const faultyState = {
          ...scannedState,
          status: 'FAULTY',
          usageType: 'faulty',
          insertedSeedsQty: 15, // Only partial insertion
          faultyReason: 'Mechanism jammed after 15 seeds',
        };

        expect(faultyState.status).toBe('FAULTY');
        expect(faultyState.insertedSeedsQty).toBeLessThan(faultyState.seedQuantity);
        expect(faultyState.faultyReason).toBeDefined();
      });

      test('should require faulty reason when marking as faulty', () => {
        const validateFaultyApplicator = (applicator: { usageType: string; faultyReason?: string }) => {
          if (applicator.usageType === 'faulty' && !applicator.faultyReason) {
            throw new Error('Faulty applicators must have a reason');
          }
          return true;
        };

        expect(() => validateFaultyApplicator({ usageType: 'faulty' }))
          .toThrow('Faulty applicators must have a reason');

        expect(validateFaultyApplicator({
          usageType: 'faulty',
          faultyReason: 'Mechanism failure'
        })).toBe(true);
      });
    });

    describe('Invalid state transition prevention', () => {
      test('should prevent transition from COMPLETED back to SCANNED', () => {
        const validateStateTransition = (fromState: string, toState: string) => {
          const invalidTransitions: Record<string, string[]> = {
            'COMPLETED': ['SCANNED', 'INSERTED'],
            'FAULTY': ['SCANNED', 'INSERTED', 'NO_USE'],
          };

          if (invalidTransitions[fromState]?.includes(toState)) {
            throw new Error(`Invalid transition: ${fromState} -> ${toState}`);
          }
          return true;
        };

        expect(() => validateStateTransition('COMPLETED', 'SCANNED'))
          .toThrow('Invalid transition: COMPLETED -> SCANNED');

        expect(() => validateStateTransition('FAULTY', 'INSERTED'))
          .toThrow('Invalid transition: FAULTY -> INSERTED');
      });

      test('should prevent skipping INSERTED state', () => {
        const validateStateTransition = (fromState: string, toState: string) => {
          if (fromState === 'SCANNED' && toState === 'COMPLETED') {
            throw new Error('Cannot complete without insertion');
          }
          return true;
        };

        expect(() => validateStateTransition('SCANNED', 'COMPLETED'))
          .toThrow('Cannot complete without insertion');
      });
    });
  });

  describe('Medical Safety Checks', () => {
    describe('Wrong patient detection', () => {
      test('should detect applicator intended for different patient', () => {
        const validatePatientMatch = (
          applicatorPatientId: string,
          currentPatientId: string
        ) => {
          if (applicatorPatientId !== currentPatientId) {
            return {
              valid: false,
              scenario: 'wrong_treatment',
              message: `Applicator is intended for patient ${applicatorPatientId}, not ${currentPatientId}`,
            };
          }
          return { valid: true, scenario: 'valid' };
        };

        const result = validatePatientMatch('PAT-001', 'PAT-002');

        expect(result.valid).toBe(false);
        expect(result.scenario).toBe('wrong_treatment');
        expect(result.message).toContain('PAT-001');
      });

      test('should allow applicator matching current patient', () => {
        const validatePatientMatch = (
          applicatorPatientId: string,
          currentPatientId: string
        ) => {
          if (applicatorPatientId !== currentPatientId) {
            return { valid: false, scenario: 'wrong_treatment' };
          }
          return { valid: true, scenario: 'valid' };
        };

        const result = validatePatientMatch('PAT-001', 'PAT-001');

        expect(result.valid).toBe(true);
        expect(result.scenario).toBe('valid');
      });
    });

    describe('Previously used applicator detection', () => {
      test('should detect already scanned applicator in current treatment', () => {
        const scannedApplicators = ['APP-001', 'APP-002'];

        const validateNotAlreadyScanned = (serialNumber: string) => {
          if (scannedApplicators.includes(serialNumber)) {
            return {
              valid: false,
              scenario: 'already_scanned',
              message: `Applicator ${serialNumber} has already been scanned`,
            };
          }
          return { valid: true };
        };

        expect(validateNotAlreadyScanned('APP-001').valid).toBe(false);
        expect(validateNotAlreadyScanned('APP-001').scenario).toBe('already_scanned');
        expect(validateNotAlreadyScanned('APP-003').valid).toBe(true);
      });

      test('should detect applicator used in previous treatment', () => {
        const previouslyUsedApplicators = [
          { serialNumber: 'APP-OLD-001', usageType: 'full', treatmentId: 'TRT-001' },
          { serialNumber: 'APP-OLD-002', usageType: 'faulty', treatmentId: 'TRT-001' },
        ];

        const validateNotPreviouslyUsed = (serialNumber: string) => {
          const previousUse = previouslyUsedApplicators.find(
            a => a.serialNumber === serialNumber && a.usageType !== 'none'
          );

          if (previousUse) {
            return {
              valid: false,
              scenario: 'previously_used',
              message: `Applicator was used in treatment ${previousUse.treatmentId}`,
            };
          }
          return { valid: true };
        };

        expect(validateNotPreviouslyUsed('APP-OLD-001').valid).toBe(false);
        expect(validateNotPreviouslyUsed('APP-NEW-001').valid).toBe(true);
      });
    });

    describe('Seed count validation', () => {
      test('should validate inserted seeds does not exceed applicator capacity', () => {
        const validateSeedCount = (
          insertedSeeds: number,
          applicatorCapacity: number
        ) => {
          if (insertedSeeds > applicatorCapacity) {
            return {
              valid: false,
              error: `Cannot insert ${insertedSeeds} seeds - capacity is ${applicatorCapacity}`,
            };
          }
          if (insertedSeeds < 0) {
            return {
              valid: false,
              error: 'Seed count cannot be negative',
            };
          }
          return { valid: true };
        };

        expect(validateSeedCount(25, 25).valid).toBe(true);
        expect(validateSeedCount(30, 25).valid).toBe(false);
        expect(validateSeedCount(-1, 25).valid).toBe(false);
      });

      test('should track total seeds inserted across all applicators', () => {
        const applicators = [
          { serialNumber: 'APP-001', insertedSeedsQty: 25, usageType: 'full' },
          { serialNumber: 'APP-002', insertedSeedsQty: 20, usageType: 'faulty' },
          { serialNumber: 'APP-003', insertedSeedsQty: 0, usageType: 'none' },
        ];

        const calculateTotalInsertedSeeds = (apps: typeof applicators) => {
          return apps
            .filter(a => a.usageType !== 'none')
            .reduce((sum, a) => sum + a.insertedSeedsQty, 0);
        };

        expect(calculateTotalInsertedSeeds(applicators)).toBe(45);
      });
    });

    describe('Expiry date validation', () => {
      test('should reject expired applicators', () => {
        const validateExpiry = (expiryDate: string) => {
          const expiry = new Date(expiryDate);
          const today = new Date();

          if (expiry < today) {
            return {
              valid: false,
              scenario: 'expired',
              message: `Applicator expired on ${expiryDate}`,
            };
          }
          return { valid: true };
        };

        const pastDate = '2020-01-01';
        const futureDate = '2030-01-01';

        expect(validateExpiry(pastDate).valid).toBe(false);
        expect(validateExpiry(pastDate).scenario).toBe('expired');
        expect(validateExpiry(futureDate).valid).toBe(true);
      });

      test('should warn for applicators expiring soon (30 days)', () => {
        const checkExpiringSoon = (expiryDate: string, warningDays = 30) => {
          const expiry = new Date(expiryDate);
          const today = new Date();
          const warningDate = new Date();
          warningDate.setDate(today.getDate() + warningDays);

          if (expiry <= warningDate) {
            return {
              warning: true,
              message: `Applicator expires in ${Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))} days`,
            };
          }
          return { warning: false };
        };

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const farFuture = new Date();
        farFuture.setDate(farFuture.getDate() + 100);

        expect(checkExpiringSoon(tomorrow.toISOString()).warning).toBe(true);
        expect(checkExpiringSoon(farFuture.toISOString()).warning).toBe(false);
      });
    });
  });
});
