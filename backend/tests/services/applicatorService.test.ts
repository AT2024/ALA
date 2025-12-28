// Applicator Service Test Suite - Medical Application Testing
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { applicatorService } from '../../src/services/applicatorService';
import { mockTreatmentData, mockApplicatorData, applicatorValidationScenarios } from '../fixtures/testData';
import {
  setupDatabaseMocks,
  setupPriorityApiMocks,
  resetAllMocks,
  mockSequelizeModel,
  mockTreatment,
  mockApplicator,
  mockTransaction
} from '../helpers/mockHelpers';

// Mock dependencies
jest.mock('../../src/models', () => ({
  Applicator: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  Treatment: {
    findByPk: jest.fn()
  }
}));

jest.mock('../../src/services/priorityService');

describe('Applicator Service', () => {
  beforeEach(() => {
    resetAllMocks();
    setupDatabaseMocks();
    setupPriorityApiMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateApplicator', () => {
    test('should validate applicator successfully (valid scenario)', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue(mockTreatment);

      const priorityService = require('../../src/services/priorityService').default;
      priorityService.getApplicatorFromPriority.mockResolvedValue({
        found: true,
        data: {
          serialNumber: 'APP-VALID-001',
          applicatorType: 'Standard Applicator Type A',
          seedQuantity: 25,
          intendedPatientId: 'PAT-2025-015',
          previousUsageType: null
        }
      });

      const result = await applicatorService.validateApplicator(
        applicatorValidationScenarios.valid.serialNumber,
        applicatorValidationScenarios.valid.treatmentId,
        applicatorValidationScenarios.valid.patientId,
        []
      );

      expect(result.isValid).toBe(true);
      expect(result.scenario).toBe('valid');
      expect(result.message).toBe('Applicator validated successfully.');
      expect(result.requiresConfirmation).toBe(false);
      expect(result.applicatorData).toEqual({
        serialNumber: 'APP-VALID-001',
        applicatorType: 'Standard Applicator Type A',
        seedQuantity: 25
      });
    });

    test('should detect already scanned applicator', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue(mockTreatment);

      const result = await applicatorService.validateApplicator(
        applicatorValidationScenarios.alreadyScanned.serialNumber,
        applicatorValidationScenarios.alreadyScanned.treatmentId,
        applicatorValidationScenarios.alreadyScanned.patientId,
        applicatorValidationScenarios.alreadyScanned.scannedApplicators
      );

      expect(result.isValid).toBe(false);
      expect(result.scenario).toBe('already_scanned');
      expect(result.message).toBe('This applicator was already scanned for this treatment.');
      expect(result.requiresConfirmation).toBe(false);
    });

    test('should detect wrong treatment scenario', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue(mockTreatment);

      const priorityService = require('../../src/services/priorityService').default;
      priorityService.getApplicatorFromPriority.mockResolvedValue({
        found: true,
        data: {
          serialNumber: 'APP-WRONG-001',
          applicatorType: 'Standard Applicator Type A',
          seedQuantity: 25,
          intendedPatientId: 'PAT-2025-999', // Different patient
          previousUsageType: null
        }
      });

      const result = await applicatorService.validateApplicator(
        applicatorValidationScenarios.wrongTreatment.serialNumber,
        applicatorValidationScenarios.wrongTreatment.treatmentId,
        applicatorValidationScenarios.wrongTreatment.patientId,
        []
      );

      expect(result.isValid).toBe(false);
      expect(result.scenario).toBe('wrong_treatment');
      expect(result.message).toBe('This applicator is intended for Patient: PAT-2025-999\n\nAre you sure you want to continue?');
      expect(result.requiresConfirmation).toBe(true);
    });

    test('should detect previously no use scenario', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue(mockTreatment);

      const priorityService = require('../../src/services/priorityService').default;
      priorityService.getApplicatorFromPriority.mockResolvedValue({
        found: true,
        data: {
          serialNumber: 'APP-NOUSER-001',
          applicatorType: 'Standard Applicator Type A',
          seedQuantity: 25,
          intendedPatientId: 'PAT-2025-015',
          previousUsageType: 'none',
          previousTreatmentId: 'SO25000010'
        }
      });

      const result = await applicatorService.validateApplicator(
        applicatorValidationScenarios.previouslyNoUse.serialNumber,
        applicatorValidationScenarios.previouslyNoUse.treatmentId,
        applicatorValidationScenarios.previouslyNoUse.patientId,
        []
      );

      expect(result.isValid).toBe(false);
      expect(result.scenario).toBe('previously_no_use');
      expect(result.message).toBe('This applicator was scanned for treatment SO25000010 with the status: "No Use"\n\nAre you sure you want to continue?');
      expect(result.requiresConfirmation).toBe(true);
    });

    test('should detect not allowed scenario when applicator not found', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue(mockTreatment);

      const priorityService = require('../../src/services/priorityService').default;
      priorityService.getApplicatorFromPriority.mockResolvedValue({
        found: false
      });

      // Mock empty import from recent treatments
      jest.spyOn(applicatorService, 'importApplicatorsFromRecentTreatments').mockResolvedValue([]);

      const result = await applicatorService.validateApplicator(
        applicatorValidationScenarios.notAllowed.serialNumber,
        applicatorValidationScenarios.notAllowed.treatmentId,
        applicatorValidationScenarios.notAllowed.patientId,
        []
      );

      expect(result.isValid).toBe(false);
      expect(result.scenario).toBe('not_allowed');
      expect(result.message).toBe('You are not allowed to use this applicator for this treatment.');
      expect(result.requiresConfirmation).toBe(false);
    });

    test('should handle treatment not found error', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue(null);

      const result = await applicatorService.validateApplicator(
        'APP-TEST-001',
        'non-existent-treatment',
        'PAT-2025-015',
        []
      );

      expect(result.isValid).toBe(false);
      expect(result.scenario).toBe('error');
      expect(result.message).toBe('Treatment not found');
      expect(result.requiresConfirmation).toBe(false);
    });

    test('should handle validation error gracefully', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockRejectedValue(new Error('Database connection failed'));

      const result = await applicatorService.validateApplicator(
        'APP-TEST-001',
        'test-treatment-uuid-001',
        'PAT-2025-015',
        []
      );

      expect(result.isValid).toBe(false);
      expect(result.scenario).toBe('error');
      expect(result.message).toBe('Database connection failed');
      expect(result.requiresConfirmation).toBe(false);
    });
  });

  describe('getApplicatorFromPriority', () => {
    test('should get applicator data from Priority', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.getApplicatorFromPriority.mockResolvedValue({
        found: true,
        data: {
          serialNumber: 'APP001-2025-001',
          partName: 'Standard Applicator',
          treatmentId: 'SO25000015',
          intendedPatientId: 'PAT-2025-015',
          usageType: 'full'
        }
      });

      priorityService.getPartDetails.mockResolvedValue({
        partDes: 'Standard Applicator Type A',
        seedQuantity: 25
      });

      const result = await applicatorService.getApplicatorFromPriority('APP001-2025-001');

      expect(result.found).toBe(true);
      expect(result.data).toEqual({
        serialNumber: 'APP001-2025-001',
        applicatorType: 'Standard Applicator Type A',
        seedQuantity: 25,
        intendedPatientId: 'PAT-2025-015',
        previousTreatmentId: 'SO25000015',
        previousUsageType: 'full'
      });
    });

    test('should handle applicator not found in Priority', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.getApplicatorFromPriority.mockResolvedValue({
        found: false
      });

      const result = await applicatorService.getApplicatorFromPriority('NONEXISTENT');

      expect(result.found).toBe(false);
      expect(result.error).toBe('Applicator not found in Priority system.');
    });

    test('should handle Priority service error', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.getApplicatorFromPriority.mockRejectedValue(new Error('Priority API error'));

      const result = await applicatorService.getApplicatorFromPriority('APP001-2025-001');

      expect(result.found).toBe(false);
      expect(result.error).toBe('Failed to fetch applicator data from Priority system.');
    });
  });

  describe('importApplicatorsFromRecentTreatments', () => {
    test('should import applicators from recent treatments', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.getTreatmentsForSiteAndDateRange.mockResolvedValue([
        { id: 'SO25000010', site: '100078', patientId: 'PAT-2025-001', date: '2025-07-09' },
        { id: 'SO25000011', site: '100078', patientId: 'PAT-2025-002', date: '2025-07-10' }
      ]);

      priorityService.getApplicatorsForTreatment.mockImplementation((treatmentId: string) => {
        if (treatmentId === 'SO25000010') {
          return Promise.resolve([
            {
              serialNumber: 'APP001-2025-001',
              applicatorType: 'Standard Applicator Type A',
              seedQuantity: 25,
              treatmentId: 'SO25000010'
            }
          ]);
        }
        return Promise.resolve([]);
      });

      const result = await applicatorService.importApplicatorsFromRecentTreatments('100078', '2025-07-10');

      expect(result).toHaveLength(1);
      expect(result[0].serialNumber).toBe('APP001-2025-001');
      expect(priorityService.getTreatmentsForSiteAndDateRange).toHaveBeenCalledWith(
        '100078',
        '2025-07-09',
        '2025-07-11'
      );
    });

    test('should handle error during import gracefully', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.getTreatmentsForSiteAndDateRange.mockRejectedValue(new Error('API error'));

      const result = await applicatorService.importApplicatorsFromRecentTreatments('100078', '2025-07-10');

      expect(result).toEqual([]);
    });
  });

  // NOTE: addApplicator() tests removed - method was deprecated in favor of addApplicatorWithTransaction()
  // The legacy addApplicator() was removed from applicatorService.ts as part of code cleanup.
  // All new applicator additions should go through treatmentController.addApplicator()
  // which uses addApplicatorWithTransaction() for proper transaction support.

  describe('addApplicatorWithTransaction', () => {
    test('should add applicator with database transaction', async () => {
      const { Applicator } = require('../../src/models');

      Applicator.create.mockResolvedValue(mockApplicator);

      // Mock Priority data transformation utilities
      const priorityDataTransformer = require('../../src/utils/priorityDataTransformer');
      jest.doMock('../../src/utils/priorityDataTransformer', () => ({
        validatePriorityDataStructure: jest.fn().mockReturnValue({ isValid: true }),
        transformPriorityApplicatorData: jest.fn().mockReturnValue({
          success: true,
          data: {
            serialNumber: 'APP001-2025-001',
            usageType: 'full',
            seedQuantity: 25,
            insertedSeedsQty: 25,
            insertionTime: new Date('2025-07-10T10:30:00Z')
          }
        }),
        transformToPriorityFormat: jest.fn().mockReturnValue({
          serialNumber: 'APP001-2025-001',
          insertionTime: '2025-07-10T10:30:00Z',
          usingType: 'full',
          insertedSeedsQty: 25,
          comments: ''
        })
      }));

      jest.spyOn(applicatorService, 'saveApplicatorToPriority').mockResolvedValue({
        success: true,
        message: 'Saved to Priority'
      });

      const result = await applicatorService.addApplicatorWithTransaction(
        mockTreatment,
        {
          SERNUM: 'APP001-2025-001',
          USINGTYPE: 'full',
          INTDATA2: 25,
          INSERTEDSEEDSQTY: 25,
          INSERTIONDATE: '2025-07-10T10:30:00Z'
        },
        'test-user-uuid-001',
        mockTransaction
      );

      expect(result.serialNumber).toBe('APP001-2025-001');
      expect(Applicator.create).toHaveBeenCalledWith(
        expect.any(Object),
        { transaction: mockTransaction }
      );
    });

    test('should validate treatment object', async () => {
      await expect(
        applicatorService.addApplicatorWithTransaction(
          null,
          { SERNUM: 'APP001' },
          'test-user-uuid-001',
          mockTransaction
        )
      ).rejects.toThrow('Invalid treatment object');

      await expect(
        applicatorService.addApplicatorWithTransaction(
          { isComplete: true },
          { SERNUM: 'APP001' },
          'test-user-uuid-001',
          mockTransaction
        )
      ).rejects.toThrow('Cannot add applicator to a completed treatment');
    });
  });

  describe('updateApplicatorForRemoval', () => {
    test('should update applicator for removal treatment', async () => {
      const { Applicator, Treatment } = require('../../src/models');

      const removalApplicator: any = { ...mockApplicator, isRemoved: false };
      const removalTreatment = { ...mockTreatment, type: 'removal' };

      Applicator.findByPk.mockResolvedValue(removalApplicator);
      Treatment.findByPk.mockResolvedValue(removalTreatment);
      removalApplicator.update = jest.fn().mockResolvedValue(removalApplicator as any) as any;

      const result = await applicatorService.updateApplicatorForRemoval(
        'test-applicator-uuid-001',
        { isRemoved: true },
        'test-user-uuid-001'
      );

      expect(removalApplicator.update).toHaveBeenCalledWith(
        expect.objectContaining({
          isRemoved: true,
          removalTime: expect.any(Date),
          removedBy: 'test-user-uuid-001'
        })
      );
    });

    test('should only work for removal treatments', async () => {
      const { Applicator, Treatment } = require('../../src/models');

      Applicator.findByPk.mockResolvedValue(mockApplicator);
      Treatment.findByPk.mockResolvedValue({ ...mockTreatment, type: 'insertion' });

      await expect(
        applicatorService.updateApplicatorForRemoval(
          'test-applicator-uuid-001',
          { isRemoved: true },
          'test-user-uuid-001'
        )
      ).rejects.toThrow('This method is only for removal treatments');
    });
  });

  describe('calculateSeedCountStatus', () => {
    test('should calculate seed count status correctly', async () => {
      const { Applicator } = require('../../src/models');

      const applicators = [
        { ...mockApplicator, seedQuantity: 25, isRemoved: true },
        { ...mockApplicator, seedQuantity: 20, isRemoved: false },
        { ...mockApplicator, seedQuantity: 15, isRemoved: true }
      ];

      Applicator.findAll.mockResolvedValue(applicators);

      const result = await applicatorService.calculateSeedCountStatus('test-treatment-uuid-001');

      expect(result.totalSeeds).toBe(60);
      expect(result.removedSeeds).toBe(40);
      expect(result.complete).toBe(false);
      expect(result.status).toBe('incomplete');
    });

    test('should detect complete removal', async () => {
      const { Applicator } = require('../../src/models');

      const applicators = [
        { ...mockApplicator, seedQuantity: 25, isRemoved: true },
        { ...mockApplicator, seedQuantity: 20, isRemoved: true }
      ];

      Applicator.findAll.mockResolvedValue(applicators);

      const result = await applicatorService.calculateSeedCountStatus('test-treatment-uuid-001');

      expect(result.totalSeeds).toBe(45);
      expect(result.removedSeeds).toBe(45);
      expect(result.complete).toBe(true);
      expect(result.status).toBe('complete');
    });
  });

  describe('saveApplicatorToPriority', () => {
    test('should save applicator to Priority successfully', async () => {
      const { Treatment } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      Treatment.findByPk.mockResolvedValue(mockTreatment);
      priorityService.updateApplicatorInPriority.mockResolvedValue({
        success: true,
        message: 'Applicator data saved to Priority successfully'
      });

      const result = await applicatorService.saveApplicatorToPriority(
        'test-treatment-uuid-001',
        {
          serialNumber: 'APP001-2025-001',
          insertionTime: '2025-07-10T10:30:00Z',
          usingType: 'full',
          insertedSeedsQty: 25,
          comments: 'Test insertion'
        }
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Applicator data saved to Priority system successfully.');
    });

    test('should handle treatment not found', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findByPk.mockResolvedValue(null);

      const result = await applicatorService.saveApplicatorToPriority(
        'non-existent-treatment',
        {
          serialNumber: 'APP001-2025-001',
          insertionTime: '2025-07-10T10:30:00Z',
          usingType: 'full',
          insertedSeedsQty: 25
        }
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe('Treatment not found');
    });
  });

  describe('mapUsageTypeToPriority', () => {
    test('should map usage types correctly', () => {
      expect(applicatorService.mapUsageTypeToPriority('full')).toBe('Full use');
      expect(applicatorService.mapUsageTypeToPriority('partial')).toBe('Partial Use');
      expect(applicatorService.mapUsageTypeToPriority('faulty')).toBe('Faulty');
      expect(applicatorService.mapUsageTypeToPriority('none')).toBe('No Use');
      expect(applicatorService.mapUsageTypeToPriority('unknown')).toBe('unknown');
    });
  });
});