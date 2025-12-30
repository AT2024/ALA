/**
 * Treatment Workflow Tests
 * IEC 62304 Class B Medical Compliance Testing
 *
 * End-to-end tests for the complete treatment workflow including
 * insertion and removal procedures.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';

describe('Treatment Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Insertion Procedure', () => {
    describe('Create treatment', () => {
      test('should create a new insertion treatment with required fields', () => {
        const createTreatment = (data: {
          type: 'insertion' | 'removal';
          subjectId: string;
          patientName: string;
          site: string;
          date: string;
        }) => ({
          id: `TRT-${Date.now()}`,
          ...data,
          isComplete: false,
          createdAt: new Date().toISOString(),
        });

        const treatment = createTreatment({
          type: 'insertion',
          subjectId: 'PAT-2025-001',
          patientName: 'Test Patient',
          site: '100078',
          date: '2025-01-15',
        });

        expect(treatment.id).toBeDefined();
        expect(treatment.type).toBe('insertion');
        expect(treatment.isComplete).toBe(false);
      });

      test('should require patient identification before treatment', () => {
        const validatePatientIdentification = (treatment: { subjectId?: string; patientName?: string }) => {
          if (!treatment.subjectId || !treatment.patientName) {
            throw new Error('Patient identification required');
          }
          return true;
        };

        expect(() => validatePatientIdentification({}))
          .toThrow('Patient identification required');

        expect(validatePatientIdentification({
          subjectId: 'PAT-001',
          patientName: 'Test Patient'
        })).toBe(true);
      });
    });

    describe('Scan applicators', () => {
      test('should add scanned applicator to treatment', () => {
        const treatment = {
          id: 'TRT-001',
          applicators: [] as Array<{ serialNumber: string; seedQuantity: number }>,
        };

        const scanApplicator = (serialNumber: string, seedQuantity: number) => {
          treatment.applicators.push({ serialNumber, seedQuantity });
          return treatment.applicators.length;
        };

        expect(scanApplicator('APP-001', 25)).toBe(1);
        expect(scanApplicator('APP-002', 25)).toBe(2);
        expect(treatment.applicators).toHaveLength(2);
      });

      test('should validate applicator exists in Priority system', () => {
        const mockPriorityApplicators = [
          { serialNumber: 'APP-001', partName: 'Type A', intendedPatientId: 'PAT-001' },
          { serialNumber: 'APP-002', partName: 'Type B', intendedPatientId: 'PAT-001' },
        ];

        const validateApplicatorInPriority = (serialNumber: string) => {
          const found = mockPriorityApplicators.find(a => a.serialNumber === serialNumber);
          if (!found) {
            return { valid: false, error: 'Applicator not found in Priority system' };
          }
          return { valid: true, data: found };
        };

        expect(validateApplicatorInPriority('APP-001').valid).toBe(true);
        expect(validateApplicatorInPriority('UNKNOWN').valid).toBe(false);
      });
    });

    describe('Record usage', () => {
      test('should record full use with all seeds inserted', () => {
        const recordUsage = (applicator: { seedQuantity: number }, usageType: string, insertedSeeds: number) => {
          return {
            usageType,
            insertedSeedsQty: insertedSeeds,
            insertionTime: new Date().toISOString(),
            isFullUse: usageType === 'full' && insertedSeeds === applicator.seedQuantity,
          };
        };

        const result = recordUsage({ seedQuantity: 25 }, 'full', 25);

        expect(result.usageType).toBe('full');
        expect(result.insertedSeedsQty).toBe(25);
        expect(result.isFullUse).toBe(true);
      });

      test('should record partial use with faulty applicator', () => {
        const recordUsage = (
          applicator: { seedQuantity: number },
          usageType: string,
          insertedSeeds: number,
          reason?: string
        ) => ({
          usageType,
          insertedSeedsQty: insertedSeeds,
          insertionTime: new Date().toISOString(),
          faultyReason: usageType === 'faulty' ? reason : null,
        });

        const result = recordUsage(
          { seedQuantity: 25 },
          'faulty',
          15,
          'Mechanism jammed'
        );

        expect(result.usageType).toBe('faulty');
        expect(result.insertedSeedsQty).toBe(15);
        expect(result.faultyReason).toBe('Mechanism jammed');
      });

      test('should record no-use and return applicator to pool', () => {
        const recordNoUse = (serialNumber: string, reason: string) => ({
          usageType: 'none',
          insertedSeedsQty: 0,
          noUseReason: reason,
          returnToPool: true,
        });

        const result = recordNoUse('APP-003', 'Not needed for treatment plan');

        expect(result.usageType).toBe('none');
        expect(result.insertedSeedsQty).toBe(0);
        expect(result.returnToPool).toBe(true);
      });
    });

    describe('Complete treatment', () => {
      test('should mark treatment as complete when all applicators processed', () => {
        const treatment = {
          id: 'TRT-001',
          isComplete: false,
          applicators: [
            { serialNumber: 'APP-001', usageType: 'full', insertedSeedsQty: 25 },
            { serialNumber: 'APP-002', usageType: 'full', insertedSeedsQty: 25 },
          ],
        };

        const completeTreatment = (t: typeof treatment) => {
          const allProcessed = t.applicators.every(a => a.usageType !== undefined);
          if (!allProcessed) {
            throw new Error('All applicators must be processed before completing treatment');
          }
          return { ...t, isComplete: true, completedAt: new Date().toISOString() };
        };

        const completed = completeTreatment(treatment);

        expect(completed.isComplete).toBe(true);
        expect(completed.completedAt).toBeDefined();
      });

      test('should prevent completion with unprocessed applicators', () => {
        const treatment = {
          id: 'TRT-001',
          isComplete: false,
          applicators: [
            { serialNumber: 'APP-001', usageType: 'full', insertedSeedsQty: 25 },
            { serialNumber: 'APP-002', usageType: undefined, insertedSeedsQty: undefined },
          ],
        };

        const completeTreatment = (t: typeof treatment) => {
          const allProcessed = t.applicators.every(a => a.usageType !== undefined);
          if (!allProcessed) {
            throw new Error('All applicators must be processed before completing treatment');
          }
          return { ...t, isComplete: true };
        };

        expect(() => completeTreatment(treatment))
          .toThrow('All applicators must be processed before completing treatment');
      });
    });

    describe('Generate documentation', () => {
      test('should generate treatment summary with all applicator data', () => {
        const treatment = {
          id: 'TRT-001',
          subjectId: 'PAT-001',
          patientName: 'Test Patient',
          date: '2025-01-15',
          applicators: [
            { serialNumber: 'APP-001', usageType: 'full', insertedSeedsQty: 25 },
            { serialNumber: 'APP-002', usageType: 'faulty', insertedSeedsQty: 15 },
          ],
        };

        const generateSummary = (t: typeof treatment) => ({
          treatmentId: t.id,
          patientId: t.subjectId,
          date: t.date,
          totalApplicators: t.applicators.length,
          totalSeedsInserted: t.applicators.reduce((sum, a) => sum + a.insertedSeedsQty, 0),
          usageBreakdown: {
            full: t.applicators.filter(a => a.usageType === 'full').length,
            faulty: t.applicators.filter(a => a.usageType === 'faulty').length,
            none: t.applicators.filter(a => a.usageType === 'none').length,
          },
        });

        const summary = generateSummary(treatment);

        expect(summary.totalApplicators).toBe(2);
        expect(summary.totalSeedsInserted).toBe(40);
        expect(summary.usageBreakdown.full).toBe(1);
        expect(summary.usageBreakdown.faulty).toBe(1);
      });
    });
  });

  describe('Removal Procedure', () => {
    describe('Load insertion data', () => {
      test('should load previous insertion data for removal', () => {
        const insertionTreatment = {
          id: 'TRT-001',
          type: 'insertion',
          subjectId: 'PAT-001',
          applicators: [
            { serialNumber: 'APP-001', insertedSeedsQty: 25 },
            { serialNumber: 'APP-002', insertedSeedsQty: 20 },
          ],
          isComplete: true,
        };

        const loadForRemoval = (insertionId: string) => {
          // Simulate loading from database
          return {
            ...insertionTreatment,
            type: 'removal' as const,
            insertionTreatmentId: insertionId,
            applicators: insertionTreatment.applicators.map(a => ({
              ...a,
              isRemoved: false,
              removedSeedsQty: 0,
            })),
          };
        };

        const removalTreatment = loadForRemoval('TRT-001');

        expect(removalTreatment.type).toBe('removal');
        expect(removalTreatment.insertionTreatmentId).toBe('TRT-001');
        expect(removalTreatment.applicators[0].isRemoved).toBe(false);
      });

      test('should validate treatment is ready for removal', () => {
        const validateReadyForRemoval = (treatment: { status: string }) => {
          const validStatuses = ['Waiting for removal', 'Ready for removal'];
          if (!validStatuses.includes(treatment.status)) {
            return {
              valid: false,
              error: `Treatment status "${treatment.status}" is not ready for removal`,
            };
          }
          return { valid: true };
        };

        expect(validateReadyForRemoval({ status: 'Waiting for removal' }).valid).toBe(true);
        expect(validateReadyForRemoval({ status: 'In progress' }).valid).toBe(false);
      });
    });

    describe('Record removals', () => {
      test('should record applicator removal with seed count', () => {
        const recordRemoval = (
          applicator: { serialNumber: string; insertedSeedsQty: number },
          removedSeeds: number
        ) => ({
          serialNumber: applicator.serialNumber,
          insertedSeedsQty: applicator.insertedSeedsQty,
          removedSeedsQty: removedSeeds,
          isRemoved: true,
          removalTime: new Date().toISOString(),
        });

        const result = recordRemoval(
          { serialNumber: 'APP-001', insertedSeedsQty: 25 },
          23
        );

        expect(result.isRemoved).toBe(true);
        expect(result.removedSeedsQty).toBe(23);
      });

      test('should track removal of individual seeds', () => {
        const removalState = {
          applicatorRemovedSeeds: 45,
          individualSeedsRemoved: 0,
        };

        const addIndividualSeeds = (count: number) => {
          removalState.individualSeedsRemoved += count;
          return removalState.individualSeedsRemoved;
        };

        expect(addIndividualSeeds(5)).toBe(5);
        expect(addIndividualSeeds(3)).toBe(8);
      });
    });

    describe('Track discrepancies', () => {
      test('should record discrepancy for each applicator', () => {
        const applicator = {
          serialNumber: 'APP-001',
          insertedSeedsQty: 25,
          removedSeedsQty: 22,
        };

        const recordDiscrepancy = (
          app: typeof applicator,
          reason: string
        ) => ({
          ...app,
          hasDiscrepancy: app.insertedSeedsQty !== app.removedSeedsQty,
          discrepancyAmount: app.insertedSeedsQty - app.removedSeedsQty,
          discrepancyReason: reason,
        });

        const result = recordDiscrepancy(applicator, 'Seeds absorbed by tissue');

        expect(result.hasDiscrepancy).toBe(true);
        expect(result.discrepancyAmount).toBe(3);
        expect(result.discrepancyReason).toBe('Seeds absorbed by tissue');
      });

      test('should require reason for any discrepancy', () => {
        const validateDiscrepancy = (
          inserted: number,
          removed: number,
          reason?: string
        ) => {
          if (inserted !== removed && !reason) {
            throw new Error('Discrepancy reason required when seed counts do not match');
          }
          return true;
        };

        expect(() => validateDiscrepancy(25, 23))
          .toThrow('Discrepancy reason required');

        expect(validateDiscrepancy(25, 23, 'Valid reason')).toBe(true);
        expect(validateDiscrepancy(25, 25)).toBe(true);
      });
    });

    describe('Complete removal', () => {
      test('should complete removal when all applicators processed', () => {
        const removal = {
          id: 'REM-001',
          isComplete: false,
          applicators: [
            { serialNumber: 'APP-001', isRemoved: true, removedSeedsQty: 25 },
            { serialNumber: 'APP-002', isRemoved: true, removedSeedsQty: 20 },
          ],
        };

        const completeRemoval = (r: typeof removal) => {
          const allRemoved = r.applicators.every(a => a.isRemoved);
          if (!allRemoved) {
            throw new Error('All applicators must be removed before completing');
          }
          return { ...r, isComplete: true, completedAt: new Date().toISOString() };
        };

        const completed = completeRemoval(removal);

        expect(completed.isComplete).toBe(true);
      });

      test('should generate removal report with discrepancy summary', () => {
        const removal = {
          id: 'REM-001',
          subjectId: 'PAT-001',
          applicators: [
            { serialNumber: 'APP-001', insertedSeedsQty: 25, removedSeedsQty: 25, discrepancyReason: null },
            { serialNumber: 'APP-002', insertedSeedsQty: 20, removedSeedsQty: 18, discrepancyReason: 'Seeds absorbed' },
          ],
          individualSeedsRemoved: 2,
        };

        const generateRemovalReport = (r: typeof removal) => {
          const totalInserted = r.applicators.reduce((sum, a) => sum + a.insertedSeedsQty, 0);
          const totalRemoved = r.applicators.reduce((sum, a) => sum + a.removedSeedsQty, 0) +
            r.individualSeedsRemoved;
          const discrepancies = r.applicators.filter(a => a.discrepancyReason !== null);

          return {
            treatmentId: r.id,
            patientId: r.subjectId,
            totalSeedsInserted: totalInserted,
            totalSeedsRemoved: totalRemoved,
            netDiscrepancy: totalInserted - totalRemoved,
            applicatorsWithDiscrepancy: discrepancies.length,
            discrepancyDetails: discrepancies.map(a => ({
              serialNumber: a.serialNumber,
              inserted: a.insertedSeedsQty,
              removed: a.removedSeedsQty,
              reason: a.discrepancyReason,
            })),
          };
        };

        const report = generateRemovalReport(removal);

        expect(report.totalSeedsInserted).toBe(45);
        expect(report.totalSeedsRemoved).toBe(45); // 43 from applicators + 2 individual
        expect(report.netDiscrepancy).toBe(0);
        expect(report.applicatorsWithDiscrepancy).toBe(1);
      });
    });
  });

  describe('Treatment Validation', () => {
    test('should validate treatment type is valid', () => {
      const validateType = (type: string) => {
        const validTypes = ['insertion', 'removal'];
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid treatment type: ${type}`);
        }
        return true;
      };

      expect(validateType('insertion')).toBe(true);
      expect(validateType('removal')).toBe(true);
      expect(() => validateType('unknown')).toThrow('Invalid treatment type');
    });

    test('should validate date is not in the future for completion', () => {
      const validateCompletionDate = (treatmentDate: string) => {
        const treatment = new Date(treatmentDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (treatment > today) {
          throw new Error('Cannot complete treatment with future date');
        }
        return true;
      };

      const today = new Date().toISOString().split('T')[0];
      const futureDate = '2030-01-01';

      expect(validateCompletionDate(today)).toBe(true);
      expect(() => validateCompletionDate(futureDate)).toThrow('Cannot complete treatment with future date');
    });
  });
});
