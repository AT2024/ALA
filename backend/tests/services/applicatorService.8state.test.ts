// Applicator Service 8-State Workflow Test Suite
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { applicatorService } from '../../src/services/applicatorService';
import { Applicator, Treatment } from '../../src/models';
import { Op } from 'sequelize';

// Mock dependencies
jest.mock('../../src/models', () => ({
  Applicator: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  Treatment: {
    findByPk: jest.fn(),
    findOne: jest.fn()
  },
  Op: {
    ne: Symbol('ne'),
    or: Symbol('or')
  }
}));

jest.mock('../../src/services/priorityService');
jest.mock('../../src/utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Applicator Service - 8-State Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('mapStatusToUsageType', () => {
    test('should map INSERTED status to full usage type', () => {
      const result = applicatorService.mapStatusToUsageType('INSERTED');
      expect(result).toBe('full');
    });

    test('should map FAULTY status to faulty usage type', () => {
      const result = applicatorService.mapStatusToUsageType('FAULTY');
      expect(result).toBe('faulty');
    });

    test('should map DEPLOYMENT_FAILURE status to faulty usage type', () => {
      const result = applicatorService.mapStatusToUsageType('DEPLOYMENT_FAILURE');
      expect(result).toBe('faulty');
    });

    test('should map DISPOSED status to none usage type', () => {
      const result = applicatorService.mapStatusToUsageType('DISPOSED');
      expect(result).toBe('none');
    });

    test('should map DISCHARGED status to none usage type', () => {
      const result = applicatorService.mapStatusToUsageType('DISCHARGED');
      expect(result).toBe('none');
    });

    test('should return null for SEALED status (intermediate state)', () => {
      const result = applicatorService.mapStatusToUsageType('SEALED');
      expect(result).toBe(null);
    });

    test('should return null for OPENED status (intermediate state)', () => {
      const result = applicatorService.mapStatusToUsageType('OPENED');
      expect(result).toBe(null);
    });

    test('should return null for LOADED status (intermediate state)', () => {
      const result = applicatorService.mapStatusToUsageType('LOADED');
      expect(result).toBe(null);
    });

    test('should return null for undefined status (backward compatibility)', () => {
      const result = applicatorService.mapStatusToUsageType(null);
      expect(result).toBe(null);
    });

    test('should return null for unknown status', () => {
      const result = applicatorService.mapStatusToUsageType('UNKNOWN_STATUS');
      expect(result).toBe(null);
    });
  });

  describe('validateStatusTransition', () => {
    test('should allow transition from SEALED to OPENED', () => {
      const result = applicatorService.validateStatusTransition('SEALED', 'OPENED');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should allow transition from SEALED to FAULTY', () => {
      const result = applicatorService.validateStatusTransition('SEALED', 'FAULTY');
      expect(result.valid).toBe(true);
    });

    test('should reject transition from SEALED to INSERTED', () => {
      const result = applicatorService.validateStatusTransition('SEALED', 'INSERTED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition from SEALED to INSERTED');
      expect(result.error).toContain('Allowed: OPENED, FAULTY');
    });

    test('should allow transition from OPENED to LOADED', () => {
      const result = applicatorService.validateStatusTransition('OPENED', 'LOADED');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from OPENED to FAULTY', () => {
      const result = applicatorService.validateStatusTransition('OPENED', 'FAULTY');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from OPENED to DISPOSED', () => {
      const result = applicatorService.validateStatusTransition('OPENED', 'DISPOSED');
      expect(result.valid).toBe(true);
    });

    test('should reject transition from OPENED to INSERTED', () => {
      const result = applicatorService.validateStatusTransition('OPENED', 'INSERTED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition from OPENED to INSERTED');
    });

    test('should allow transition from LOADED to INSERTED', () => {
      const result = applicatorService.validateStatusTransition('LOADED', 'INSERTED');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from LOADED to FAULTY', () => {
      const result = applicatorService.validateStatusTransition('LOADED', 'FAULTY');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from LOADED to DEPLOYMENT_FAILURE', () => {
      const result = applicatorService.validateStatusTransition('LOADED', 'DEPLOYMENT_FAILURE');
      expect(result.valid).toBe(true);
    });

    test('should reject transition from LOADED to DISPOSED', () => {
      const result = applicatorService.validateStatusTransition('LOADED', 'DISPOSED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition from LOADED to DISPOSED');
    });

    test('should allow transition from INSERTED to DISCHARGED', () => {
      const result = applicatorService.validateStatusTransition('INSERTED', 'DISCHARGED');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from INSERTED to DISPOSED', () => {
      const result = applicatorService.validateStatusTransition('INSERTED', 'DISPOSED');
      expect(result.valid).toBe(true);
    });

    test('should reject transition from INSERTED to FAULTY', () => {
      const result = applicatorService.validateStatusTransition('INSERTED', 'FAULTY');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition from INSERTED to FAULTY');
    });

    test('should allow transition from FAULTY to DISPOSED', () => {
      const result = applicatorService.validateStatusTransition('FAULTY', 'DISPOSED');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from FAULTY to DISCHARGED', () => {
      const result = applicatorService.validateStatusTransition('FAULTY', 'DISCHARGED');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from DEPLOYMENT_FAILURE to DISPOSED', () => {
      const result = applicatorService.validateStatusTransition('DEPLOYMENT_FAILURE', 'DISPOSED');
      expect(result.valid).toBe(true);
    });

    test('should allow transition from DEPLOYMENT_FAILURE to FAULTY', () => {
      const result = applicatorService.validateStatusTransition('DEPLOYMENT_FAILURE', 'FAULTY');
      expect(result.valid).toBe(true);
    });

    test('should reject transition from terminal state DISPOSED', () => {
      const result = applicatorService.validateStatusTransition('DISPOSED', 'SEALED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition from terminal state DISPOSED');
    });

    test('should reject transition from terminal state DISCHARGED', () => {
      const result = applicatorService.validateStatusTransition('DISCHARGED', 'SEALED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition from terminal state DISCHARGED');
    });

    test('should allow any initial status when current status is null', () => {
      const result = applicatorService.validateStatusTransition(null, 'OPENED');
      expect(result.valid).toBe(true);
    });

    test('should handle invalid current status', () => {
      const result = applicatorService.validateStatusTransition('INVALID_STATUS', 'OPENED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid current status: INVALID_STATUS');
    });
  });

  describe('createPackage', () => {
    const mockTreatmentId = 'test-treatment-uuid-001';
    const mockApplicators = [
      {
        id: 'app-1',
        serialNumber: 'APP001',
        seedQuantity: 25,
        status: 'SCANNED',
        treatmentId: mockTreatmentId,
        packageLabel: null,
        update: jest.fn().mockResolvedValue({ id: 'app-1', packageLabel: 'P1' })
      },
      {
        id: 'app-2',
        serialNumber: 'APP002',
        seedQuantity: 25,
        status: 'SCANNED',
        treatmentId: mockTreatmentId,
        packageLabel: null,
        update: jest.fn().mockResolvedValue({ id: 'app-2', packageLabel: 'P1' })
      },
      {
        id: 'app-3',
        serialNumber: 'APP003',
        seedQuantity: 25,
        status: 'SCANNED',
        treatmentId: mockTreatmentId,
        packageLabel: null,
        update: jest.fn().mockResolvedValue({ id: 'app-3', packageLabel: 'P1' })
      },
      {
        id: 'app-4',
        serialNumber: 'APP004',
        seedQuantity: 25,
        status: 'SCANNED',
        treatmentId: mockTreatmentId,
        packageLabel: null,
        update: jest.fn().mockResolvedValue({ id: 'app-4', packageLabel: 'P1' })
      }
    ];

    beforeEach(() => {
      const { Treatment, Applicator } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue({
        id: mockTreatmentId,
        type: 'pancreas_insertion',
        subjectId: 'PAT-001'
      });
    });

    test('should create package successfully with 4 applicators', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue(mockApplicators);

      // Mock getNextPackageLabel
      jest.spyOn(applicatorService, 'getNextPackageLabel').mockResolvedValue('P1');

      const result = await applicatorService.createPackage(
        mockTreatmentId,
        ['app-1', 'app-2', 'app-3', 'app-4']
      );

      expect(result).toHaveLength(4);
      expect(mockApplicators[0].update).toHaveBeenCalledWith({ packageLabel: 'P1' });
      expect(mockApplicators[1].update).toHaveBeenCalledWith({ packageLabel: 'P1' });
      expect(mockApplicators[2].update).toHaveBeenCalledWith({ packageLabel: 'P1' });
      expect(mockApplicators[3].update).toHaveBeenCalledWith({ packageLabel: 'P1' });
    });

    test('should reject package with less than 4 applicators', async () => {
      await expect(
        applicatorService.createPackage(mockTreatmentId, ['app-1', 'app-2', 'app-3'])
      ).rejects.toThrow('Package must contain exactly 4 applicators (received 3)');
    });

    test('should reject package with more than 4 applicators', async () => {
      await expect(
        applicatorService.createPackage(mockTreatmentId, ['app-1', 'app-2', 'app-3', 'app-4', 'app-5'])
      ).rejects.toThrow('Package must contain exactly 4 applicators (received 5)');
    });

    test('should reject if treatment not found', async () => {
      const { Treatment } = require('../../src/models');
      Treatment.findByPk.mockResolvedValue(null);

      await expect(
        applicatorService.createPackage(mockTreatmentId, ['app-1', 'app-2', 'app-3', 'app-4'])
      ).rejects.toThrow(`Treatment not found: ${mockTreatmentId}`);
    });

    test('should reject if not all applicators found', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue([mockApplicators[0], mockApplicators[1]]); // Only 2 found

      await expect(
        applicatorService.createPackage(mockTreatmentId, ['app-1', 'app-2', 'app-3', 'app-4'])
      ).rejects.toThrow('Found 2 applicators, expected 4');
    });

    test('should reject if applicators belong to different treatments', async () => {
      const { Applicator } = require('../../src/models');
      const mixedApplicators = [
        ...mockApplicators.slice(0, 3),
        { ...mockApplicators[3], treatmentId: 'different-treatment-id' }
      ];
      Applicator.findAll.mockResolvedValue(mixedApplicators);

      await expect(
        applicatorService.createPackage(mockTreatmentId, ['app-1', 'app-2', 'app-3', 'app-4'])
      ).rejects.toThrow('belongs to different treatment');
    });

    test('should reject if applicators have different seed quantities', async () => {
      const { Applicator } = require('../../src/models');
      const differentSeedQtyApplicators = [
        ...mockApplicators.slice(0, 3),
        { ...mockApplicators[3], seedQuantity: 20 } // Different seed quantity
      ];
      Applicator.findAll.mockResolvedValue(differentSeedQtyApplicators);

      await expect(
        applicatorService.createPackage(mockTreatmentId, ['app-1', 'app-2', 'app-3', 'app-4'])
      ).rejects.toThrow('All applicators must have same seed quantity');
    });

    test('should reject if applicator has wrong status', async () => {
      const { Applicator } = require('../../src/models');
      const wrongStatusApplicators = [
        ...mockApplicators.slice(0, 3),
        { ...mockApplicators[3], status: 'INSERTED' } // Wrong status
      ];
      Applicator.findAll.mockResolvedValue(wrongStatusApplicators);

      await expect(
        applicatorService.createPackage(mockTreatmentId, ['app-1', 'app-2', 'app-3', 'app-4'])
      ).rejects.toThrow('All applicators must be in ready status');
    });

    test('should accept null status (backward compatibility)', async () => {
      const { Applicator } = require('../../src/models');
      const nullStatusApplicators = mockApplicators.map(app => ({ ...app, status: null }));
      Applicator.findAll.mockResolvedValue(nullStatusApplicators);
      jest.spyOn(applicatorService, 'getNextPackageLabel').mockResolvedValue('P1');

      const result = await applicatorService.createPackage(
        mockTreatmentId,
        ['app-1', 'app-2', 'app-3', 'app-4']
      );

      expect(result).toHaveLength(4);
    });
  });

  describe('getNextPackageLabel', () => {
    const mockTreatmentId = 'test-treatment-uuid-001';

    test('should return P1 when no packages exist', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue([]);

      const result = await applicatorService.getNextPackageLabel(mockTreatmentId);
      expect(result).toBe('P1');
    });

    test('should return P2 when P1 exists', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue([
        { packageLabel: 'P1' }
      ]);

      const result = await applicatorService.getNextPackageLabel(mockTreatmentId);
      expect(result).toBe('P2');
    });

    test('should return P3 when P2 exists', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue([
        { packageLabel: 'P2' }
      ]);

      const result = await applicatorService.getNextPackageLabel(mockTreatmentId);
      expect(result).toBe('P3');
    });

    test('should handle high package numbers correctly', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue([
        { packageLabel: 'P99' }
      ]);

      const result = await applicatorService.getNextPackageLabel(mockTreatmentId);
      expect(result).toBe('P100');
    });

    test('should return P1 if highest label is null', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue([
        { packageLabel: null }
      ]);

      const result = await applicatorService.getNextPackageLabel(mockTreatmentId);
      expect(result).toBe('P1');
    });

    test('should return P1 if highest label has invalid format', async () => {
      const { Applicator } = require('../../src/models');
      Applicator.findAll.mockResolvedValue([
        { packageLabel: 'INVALID' }
      ]);

      const result = await applicatorService.getNextPackageLabel(mockTreatmentId);
      expect(result).toBe('P1');
    });
  });

  describe('saveApplicatorToPriority - with status field', () => {
    const mockTreatmentId = 'test-treatment-uuid-001';

    beforeEach(() => {
      const { Treatment } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      Treatment.findByPk.mockResolvedValue({
        id: mockTreatmentId,
        priorityId: 'SO25000015',
        subjectId: 'PAT-001',
        site: '100078',
        date: '2025-07-10'
      });

      priorityService.updateApplicatorInPriority.mockResolvedValue({
        success: true,
        message: 'Updated in Priority'
      });
    });

    test('should skip Priority sync for SEALED status (intermediate)', async () => {
      const result = await applicatorService.saveApplicatorToPriority(mockTreatmentId, {
        serialNumber: 'APP001',
        insertionTime: '2025-07-10T10:30:00Z',
        usingType: 'full',
        insertedSeedsQty: 25,
        status: 'SEALED'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('intermediate state');
      expect(result.message).not.toContain('synced to Priority');
    });

    test('should skip Priority sync for OPENED status (intermediate)', async () => {
      const result = await applicatorService.saveApplicatorToPriority(mockTreatmentId, {
        serialNumber: 'APP001',
        insertionTime: '2025-07-10T10:30:00Z',
        usingType: 'full',
        insertedSeedsQty: 25,
        status: 'OPENED'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('intermediate state');
    });

    test('should skip Priority sync for LOADED status (intermediate)', async () => {
      const result = await applicatorService.saveApplicatorToPriority(mockTreatmentId, {
        serialNumber: 'APP001',
        insertionTime: '2025-07-10T10:30:00Z',
        usingType: 'full',
        insertedSeedsQty: 25,
        status: 'LOADED'
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('intermediate state');
    });

    test('should sync to Priority for INSERTED status (terminal)', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      const result = await applicatorService.saveApplicatorToPriority(mockTreatmentId, {
        serialNumber: 'APP001',
        insertionTime: '2025-07-10T10:30:00Z',
        usingType: 'full',
        insertedSeedsQty: 25,
        status: 'INSERTED'
      });

      expect(result.success).toBe(true);
      expect(priorityService.updateApplicatorInPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          serialNumber: 'APP001',
          usageType: 'Full use' // Mapped from 'full'
        })
      );
    });

    test('should sync to Priority for FAULTY status (terminal)', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      const result = await applicatorService.saveApplicatorToPriority(mockTreatmentId, {
        serialNumber: 'APP001',
        insertionTime: '2025-07-10T10:30:00Z',
        usingType: 'full',
        insertedSeedsQty: 0,
        status: 'FAULTY'
      });

      expect(result.success).toBe(true);
      expect(priorityService.updateApplicatorInPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          serialNumber: 'APP001',
          usageType: 'Faulty' // Mapped from 'faulty'
        })
      );
    });

    test('should sync to Priority for DISPOSED status (terminal)', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      const result = await applicatorService.saveApplicatorToPriority(mockTreatmentId, {
        serialNumber: 'APP001',
        insertionTime: '2025-07-10T10:30:00Z',
        usingType: 'none',
        insertedSeedsQty: 0,
        status: 'DISPOSED'
      });

      expect(result.success).toBe(true);
      expect(priorityService.updateApplicatorInPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          serialNumber: 'APP001',
          usageType: 'No Use' // Mapped from 'none'
        })
      );
    });

    test('should use usingType when status is not provided (backward compatibility)', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      const result = await applicatorService.saveApplicatorToPriority(mockTreatmentId, {
        serialNumber: 'APP001',
        insertionTime: '2025-07-10T10:30:00Z',
        usingType: 'full',
        insertedSeedsQty: 25
        // No status field
      });

      expect(result.success).toBe(true);
      expect(priorityService.updateApplicatorInPriority).toHaveBeenCalledWith(
        expect.objectContaining({
          serialNumber: 'APP001',
          usageType: 'Full use'
        })
      );
    });
  });
});
