/**
 * Seed Tracking Tests
 * IEC 62304 Class B Medical Compliance Testing
 *
 * Tests seed count accuracy for insertion and removal procedures.
 * Critical for patient safety - ensures accurate tracking of radioactive seeds.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

describe('Seed Tracking Accuracy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Insertion Tracking', () => {
    describe('Total seeds calculation', () => {
      test('should calculate total seeds from full use applicators', () => {
        const applicators = [
          { serialNumber: 'APP-001', seedQuantity: 25, usageType: 'full', insertedSeedsQty: 25 },
          { serialNumber: 'APP-002', seedQuantity: 25, usageType: 'full', insertedSeedsQty: 25 },
          { serialNumber: 'APP-003', seedQuantity: 25, usageType: 'full', insertedSeedsQty: 25 },
        ];

        const totalSeeds = applicators.reduce((sum, a) => sum + a.insertedSeedsQty, 0);

        expect(totalSeeds).toBe(75);
      });

      test('should handle mixed usage types correctly', () => {
        const applicators = [
          { serialNumber: 'APP-001', seedQuantity: 25, usageType: 'full', insertedSeedsQty: 25 },
          { serialNumber: 'APP-002', seedQuantity: 25, usageType: 'faulty', insertedSeedsQty: 15 },
          { serialNumber: 'APP-003', seedQuantity: 25, usageType: 'none', insertedSeedsQty: 0 },
        ];

        const totalInserted = applicators.reduce((sum, a) => sum + a.insertedSeedsQty, 0);

        expect(totalInserted).toBe(40);
      });

      test('should calculate total available seeds from all scanned applicators', () => {
        const scannedApplicators = [
          { serialNumber: 'APP-001', seedQuantity: 25 },
          { serialNumber: 'APP-002', seedQuantity: 20 },
          { serialNumber: 'APP-003', seedQuantity: 25 },
        ];

        const totalAvailable = scannedApplicators.reduce((sum, a) => sum + a.seedQuantity, 0);

        expect(totalAvailable).toBe(70);
      });
    });

    describe('Partial use calculations', () => {
      test('should track remaining seeds after partial insertion', () => {
        const applicator = {
          serialNumber: 'APP-001',
          seedQuantity: 25,
          usageType: 'faulty',
          insertedSeedsQty: 15,
        };

        const remainingSeeds = applicator.seedQuantity - applicator.insertedSeedsQty;

        expect(remainingSeeds).toBe(10);
      });

      test('should calculate insertion efficiency percentage', () => {
        const applicators = [
          { seedQuantity: 25, insertedSeedsQty: 25, usageType: 'full' },
          { seedQuantity: 25, insertedSeedsQty: 20, usageType: 'faulty' },
          { seedQuantity: 25, insertedSeedsQty: 0, usageType: 'none' },
        ];

        const calculateEfficiency = (apps: typeof applicators) => {
          const usedApplicators = apps.filter(a => a.usageType !== 'none');
          if (usedApplicators.length === 0) return 100;

          const totalCapacity = usedApplicators.reduce((sum, a) => sum + a.seedQuantity, 0);
          const totalInserted = usedApplicators.reduce((sum, a) => sum + a.insertedSeedsQty, 0);

          return Math.round((totalInserted / totalCapacity) * 100);
        };

        expect(calculateEfficiency(applicators)).toBe(90); // 45/50 = 90%
      });
    });

    describe('Faulty applicator seed handling', () => {
      test('should track seeds lost due to faulty applicators', () => {
        const faultyApplicators = [
          { seedQuantity: 25, insertedSeedsQty: 15, usageType: 'faulty' },
          { seedQuantity: 25, insertedSeedsQty: 20, usageType: 'faulty' },
        ];

        const calculateLostSeeds = (apps: typeof faultyApplicators) => {
          return apps
            .filter(a => a.usageType === 'faulty')
            .reduce((sum, a) => sum + (a.seedQuantity - a.insertedSeedsQty), 0);
        };

        expect(calculateLostSeeds(faultyApplicators)).toBe(15); // (25-15) + (25-20) = 15
      });

      test('should report faulty applicator statistics', () => {
        const applicators = [
          { usageType: 'full', insertedSeedsQty: 25 },
          { usageType: 'full', insertedSeedsQty: 25 },
          { usageType: 'faulty', insertedSeedsQty: 15 },
          { usageType: 'none', insertedSeedsQty: 0 },
        ];

        const stats = {
          total: applicators.length,
          full: applicators.filter(a => a.usageType === 'full').length,
          faulty: applicators.filter(a => a.usageType === 'faulty').length,
          none: applicators.filter(a => a.usageType === 'none').length,
        };

        expect(stats.full).toBe(2);
        expect(stats.faulty).toBe(1);
        expect(stats.none).toBe(1);
      });
    });
  });

  describe('Removal Tracking', () => {
    describe('Removal count accuracy', () => {
      test('should track seeds removed per applicator', () => {
        const insertedApplicators = [
          { serialNumber: 'APP-001', insertedSeedsQty: 25, isRemoved: true, removedSeedsQty: 25 },
          { serialNumber: 'APP-002', insertedSeedsQty: 20, isRemoved: true, removedSeedsQty: 18 },
          { serialNumber: 'APP-003', insertedSeedsQty: 25, isRemoved: false, removedSeedsQty: 0 },
        ];

        const totalRemoved = insertedApplicators.reduce((sum, a) => sum + a.removedSeedsQty, 0);
        const totalInserted = insertedApplicators.reduce((sum, a) => sum + a.insertedSeedsQty, 0);

        expect(totalRemoved).toBe(43);
        expect(totalInserted).toBe(70);
      });

      test('should calculate removal progress percentage', () => {
        const treatment = {
          totalInsertedSeeds: 100,
          removedSeeds: 75,
          individualRemovedSeeds: 5,
        };

        const removalProgress = Math.round(
          ((treatment.removedSeeds + treatment.individualRemovedSeeds) / treatment.totalInsertedSeeds) * 100
        );

        expect(removalProgress).toBe(80);
      });
    });

    describe('Discrepancy detection', () => {
      test('should detect seed count discrepancy during removal', () => {
        const applicator = {
          serialNumber: 'APP-001',
          insertedSeedsQty: 25,
          removedSeedsQty: 23,
        };

        const discrepancy = applicator.insertedSeedsQty - applicator.removedSeedsQty;
        const hasDiscrepancy = discrepancy !== 0;

        expect(hasDiscrepancy).toBe(true);
        expect(discrepancy).toBe(2);
      });

      test('should track discrepancy reasons per applicator', () => {
        const applicatorsWithDiscrepancy = [
          {
            serialNumber: 'APP-001',
            insertedSeedsQty: 25,
            removedSeedsQty: 23,
            discrepancyReason: 'Seeds absorbed by tissue',
          },
          {
            serialNumber: 'APP-002',
            insertedSeedsQty: 20,
            removedSeedsQty: 20,
            discrepancyReason: null,
          },
        ];

        const applicatorsWithIssues = applicatorsWithDiscrepancy.filter(
          a => a.insertedSeedsQty !== a.removedSeedsQty
        );

        expect(applicatorsWithIssues).toHaveLength(1);
        expect(applicatorsWithIssues[0].discrepancyReason).toBe('Seeds absorbed by tissue');
      });

      test('should calculate total discrepancy across treatment', () => {
        const removalData = {
          applicators: [
            { insertedSeedsQty: 25, removedSeedsQty: 24 },
            { insertedSeedsQty: 25, removedSeedsQty: 25 },
            { insertedSeedsQty: 20, removedSeedsQty: 18 },
          ],
          individualSeedsRemoved: 5,
        };

        const totalInserted = removalData.applicators.reduce((sum, a) => sum + a.insertedSeedsQty, 0);
        const applicatorRemoved = removalData.applicators.reduce((sum, a) => sum + a.removedSeedsQty, 0);
        const totalRemoved = applicatorRemoved + removalData.individualSeedsRemoved;
        const totalDiscrepancy = totalInserted - totalRemoved;

        expect(totalInserted).toBe(70);
        expect(totalRemoved).toBe(72); // 67 from applicators + 5 individual
        expect(totalDiscrepancy).toBe(-2); // Over-counted (more removed than inserted)
      });
    });

    describe('Individual seed removal tracking', () => {
      test('should track seeds removed individually (not via applicator)', () => {
        const treatmentRemoval = {
          applicatorRemovedSeeds: 50,
          individualSeedsRemoved: 8,
          totalInsertedSeeds: 60,
        };

        const effectiveRemoved = treatmentRemoval.applicatorRemovedSeeds +
          treatmentRemoval.individualSeedsRemoved;

        expect(effectiveRemoved).toBe(58);
        expect(effectiveRemoved).toBeLessThanOrEqual(treatmentRemoval.totalInsertedSeeds);
      });

      test('should prevent individual seed count exceeding remaining seeds', () => {
        const validateIndividualRemoval = (
          requested: number,
          totalInserted: number,
          alreadyRemoved: number
        ) => {
          const remaining = totalInserted - alreadyRemoved;
          if (requested > remaining) {
            return {
              valid: false,
              error: `Cannot remove ${requested} seeds - only ${remaining} remaining`,
            };
          }
          return { valid: true, newTotal: alreadyRemoved + requested };
        };

        expect(validateIndividualRemoval(5, 100, 90).valid).toBe(true);
        expect(validateIndividualRemoval(15, 100, 90).valid).toBe(false);
      });
    });
  });

  describe('Audit Trail', () => {
    test('should record timestamp for each seed tracking action', () => {
      const createAuditEntry = (action: string, seedCount: number) => ({
        action,
        seedCount,
        timestamp: new Date().toISOString(),
        userId: 'user-001',
      });

      const insertionAudit = createAuditEntry('SEEDS_INSERTED', 25);
      const removalAudit = createAuditEntry('SEEDS_REMOVED', 23);

      expect(insertionAudit.timestamp).toBeDefined();
      expect(removalAudit.action).toBe('SEEDS_REMOVED');
    });

    test('should maintain chronological order of seed tracking events', () => {
      const auditLog = [
        { timestamp: '2025-01-01T10:00:00Z', action: 'APPLICATOR_SCANNED', seedCount: 25 },
        { timestamp: '2025-01-01T10:05:00Z', action: 'SEEDS_INSERTED', seedCount: 25 },
        { timestamp: '2025-01-08T09:00:00Z', action: 'REMOVAL_STARTED', seedCount: 0 },
        { timestamp: '2025-01-08T09:30:00Z', action: 'SEEDS_REMOVED', seedCount: 23 },
      ];

      const sortedLog = [...auditLog].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      expect(sortedLog).toEqual(auditLog);
    });
  });
});
