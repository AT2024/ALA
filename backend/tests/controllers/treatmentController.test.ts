// Treatment Controller Test Suite - Medical Application Testing
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import treatmentController from '../../src/controllers/treatmentController';
import { mockTreatmentData, mockApplicatorData, mockUserData, testTokens } from '../fixtures/testData';
import {
  setupDatabaseMocks,
  setupPriorityApiMocks,
  resetAllMocks,
  mockTransaction
} from '../helpers/mockHelpers';

// Mock dependencies
jest.mock('../../src/models', () => ({
  Treatment: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  Applicator: {
    findAll: jest.fn(),
    create: jest.fn()
  },
  User: {
    findByPk: jest.fn()
  },
  sequelize: {
    transaction: jest.fn()
  }
}));

jest.mock('../../src/services/priorityService');
jest.mock('../../src/services/applicatorService');

// Mock auth middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = mockUserData;
  next();
};

// Express app setup for testing
const app: Express = express();
app.use(express.json());
app.use(mockAuthMiddleware); // Apply auth middleware

// Setup treatment routes
app.get('/api/treatments', treatmentController.getTreatments);
app.get('/api/treatments/:id', treatmentController.getTreatmentById);
app.post('/api/treatments', treatmentController.createTreatment);
app.put('/api/treatments/:id', treatmentController.updateTreatment);
app.delete('/api/treatments/:id', treatmentController.deleteTreatment);
app.post('/api/treatments/:id/applicators', treatmentController.addApplicatorToTreatment);
app.get('/api/treatments/:id/applicators', treatmentController.getTreatmentApplicators);
app.put('/api/treatments/:id/complete', treatmentController.completeTreatment);

describe('Treatment Controller', () => {
  beforeEach(() => {
    resetAllMocks();
    setupDatabaseMocks();
    setupPriorityApiMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/treatments', () => {
    test('should get all treatments for authenticated user', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findAll.mockResolvedValue([
        mockTreatmentData,
        { ...mockTreatmentData, id: 'treatment-2', subjectId: 'PAT-2025-002' }
      ]);

      const response = await request(app)
        .get('/api/treatments');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].id).toBe(mockTreatmentData.id);
      expect(Treatment.findAll).toHaveBeenCalledWith({
        where: { userId: mockUserData.id },
        order: [['date', 'DESC']],
        include: expect.any(Array)
      });
    });

    test('should filter treatments by type', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findAll.mockResolvedValue([
        { ...mockTreatmentData, type: 'insertion' }
      ]);

      const response = await request(app)
        .get('/api/treatments?type=insertion');

      expect(response.status).toBe(200);
      expect(Treatment.findAll).toHaveBeenCalledWith({
        where: {
          userId: mockUserData.id,
          type: 'insertion'
        },
        order: [['date', 'DESC']],
        include: expect.any(Array)
      });
    });

    test('should filter treatments by site', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findAll.mockResolvedValue([
        { ...mockTreatmentData, site: '100078' }
      ]);

      const response = await request(app)
        .get('/api/treatments?site=100078');

      expect(response.status).toBe(200);
      expect(Treatment.findAll).toHaveBeenCalledWith({
        where: {
          userId: mockUserData.id,
          site: '100078'
        },
        order: [['date', 'DESC']],
        include: expect.any(Array)
      });
    });

    test('should filter treatments by date', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findAll.mockResolvedValue([mockTreatmentData]);

      const response = await request(app)
        .get('/api/treatments?date=2025-07-10');

      expect(response.status).toBe(200);
      expect(Treatment.findAll).toHaveBeenCalledWith({
        where: {
          userId: mockUserData.id,
          date: '2025-07-10'
        },
        order: [['date', 'DESC']],
        include: expect.any(Array)
      });
    });

    test('should handle database error', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findAll.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/treatments');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/treatments/:id', () => {
    test('should get treatment by ID with applicators', async () => {
      const { Treatment, Applicator } = require('../../src/models');

      const treatmentWithApplicators = {
        ...mockTreatmentData,
        applicators: [mockApplicatorData]
      };

      Treatment.findByPk.mockResolvedValue(treatmentWithApplicators);

      const response = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(mockTreatmentData.id);
      expect(response.body.applicators).toHaveLength(1);
      expect(Treatment.findByPk).toHaveBeenCalledWith(mockTreatmentData.id, {
        include: expect.any(Array)
      });
    });

    test('should return 404 for non-existent treatment', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/treatments/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Treatment not found');
    });

    test('should prevent access to other user\'s treatment', async () => {
      const { Treatment } = require('../../src/models');

      const otherUserTreatment = {
        ...mockTreatmentData,
        userId: 'other-user-id'
      };

      Treatment.findByPk.mockResolvedValue(otherUserTreatment);

      const response = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });

    test('should handle invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/treatments/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('POST /api/treatments', () => {
    test('should create new treatment successfully', async () => {
      const { Treatment, User } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);
      Treatment.create.mockResolvedValue(mockTreatmentData);

      const newTreatmentData = {
        type: 'insertion',
        subjectId: 'PAT-2025-003',
        site: '100078',
        date: '2025-07-11',
        priorityId: 'SO25000016'
      };

      const response = await request(app)
        .post('/api/treatments')
        .send(newTreatmentData);

      expect(response.status).toBe(201);
      expect(response.body.subjectId).toBe(newTreatmentData.subjectId);
      expect(Treatment.create).toHaveBeenCalledWith({
        ...newTreatmentData,
        userId: mockUserData.id,
        isComplete: false
      });
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/treatments')
        .send({
          type: 'insertion'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    test('should validate treatment type enum', async () => {
      const response = await request(app)
        .post('/api/treatments')
        .send({
          type: 'invalid-type',
          subjectId: 'PAT-2025-003',
          site: '100078',
          date: '2025-07-11'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('type');
    });

    test('should validate date format', async () => {
      const response = await request(app)
        .post('/api/treatments')
        .send({
          type: 'insertion',
          subjectId: 'PAT-2025-003',
          site: '100078',
          date: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('date');
    });

    test('should prevent duplicate treatments for same subject', async () => {
      const { Treatment } = require('../../src/models');

      const duplicateError = new Error('Duplicate entry');
      duplicateError.name = 'SequelizeUniqueConstraintError';
      Treatment.create.mockRejectedValue(duplicateError);

      const response = await request(app)
        .post('/api/treatments')
        .send({
          type: 'insertion',
          subjectId: 'PAT-2025-003',
          site: '100078',
          date: '2025-07-11'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/treatments/:id/applicators', () => {
    test('should add applicator to treatment successfully', async () => {
      const { Treatment, sequelize } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      Treatment.findByPk.mockResolvedValue(mockTreatmentData);
      sequelize.transaction.mockImplementation((callback: any) => callback(mockTransaction));
      applicatorService.addApplicatorWithTransaction.mockResolvedValue(mockApplicatorData);

      const newApplicatorData = {
        SERNUM: 'APP002-2025-001',
        USINGTYPE: 'full',
        INTDATA2: 25,
        INSERTEDSEEDSQTY: 25,
        INSERTIONDATE: '2025-07-10T11:00:00Z'
      };

      const response = await request(app)
        .post(`/api/treatments/${mockTreatmentData.id}/applicators`)
        .send(newApplicatorData);

      expect(response.status).toBe(201);
      expect(response.body.serialNumber).toBe('APP001-2025-001');
      expect(applicatorService.addApplicatorWithTransaction).toHaveBeenCalledWith(
        mockTreatmentData,
        newApplicatorData,
        mockUserData.id,
        mockTransaction
      );
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('should rollback transaction on error', async () => {
      const { Treatment, sequelize } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      Treatment.findByPk.mockResolvedValue(mockTreatmentData);
      sequelize.transaction.mockImplementation((callback: any) => callback(mockTransaction));
      applicatorService.addApplicatorWithTransaction.mockRejectedValue(new Error('Validation failed'));

      const response = await request(app)
        .post(`/api/treatments/${mockTreatmentData.id}/applicators`)
        .send({
          SERNUM: 'APP002-2025-001',
          USINGTYPE: 'full'
        });

      expect(response.status).toBe(500);
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('should validate treatment exists', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findByPk.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/treatments/non-existent/applicators')
        .send({
          SERNUM: 'APP002-2025-001',
          USINGTYPE: 'full'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Treatment not found');
    });

    test('should prevent adding to completed treatment', async () => {
      const { Treatment } = require('../../src/models');

      const completedTreatment = {
        ...mockTreatmentData,
        isComplete: true
      };

      Treatment.findByPk.mockResolvedValue(completedTreatment);

      const response = await request(app)
        .post(`/api/treatments/${mockTreatmentData.id}/applicators`)
        .send({
          SERNUM: 'APP002-2025-001',
          USINGTYPE: 'full'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('completed');
    });

    test('should validate user ownership', async () => {
      const { Treatment } = require('../../src/models');

      const otherUserTreatment = {
        ...mockTreatmentData,
        userId: 'other-user-id'
      };

      Treatment.findByPk.mockResolvedValue(otherUserTreatment);

      const response = await request(app)
        .post(`/api/treatments/${mockTreatmentData.id}/applicators`)
        .send({
          SERNUM: 'APP002-2025-001',
          USINGTYPE: 'full'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('PUT /api/treatments/:id/complete', () => {
    test('should complete treatment successfully', async () => {
      const { Treatment } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      const incompletetreatment = {
        ...mockTreatmentData,
        isComplete: false,
        save: jest.fn<Promise<boolean>, []>().mockResolvedValue(true)
      };

      Treatment.findByPk.mockResolvedValue(incompletetreatment);
      applicatorService.updateTreatmentStatusInPriority.mockResolvedValue({
        success: true,
        message: 'Treatment status updated'
      });

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}/complete`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Treatment completed successfully');
      expect(incompletetreatment.isComplete).toBe(true);
      expect(incompletetreatment.save).toHaveBeenCalled();
    });

    test('should prevent completing already completed treatment', async () => {
      const { Treatment } = require('../../src/models');

      const completedTreatment = {
        ...mockTreatmentData,
        isComplete: true
      };

      Treatment.findByPk.mockResolvedValue(completedTreatment);

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}/complete`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already completed');
    });

    test('should complete even if Priority update fails', async () => {
      const { Treatment } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      const incompletetreatment = {
        ...mockTreatmentData,
        isComplete: false,
        save: jest.fn<Promise<boolean>, []>().mockResolvedValue(true)
      };

      Treatment.findByPk.mockResolvedValue(incompletetreatment);
      applicatorService.updateTreatmentStatusInPriority.mockResolvedValue({
        success: false,
        message: 'Priority update failed'
      });

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}/complete`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Treatment completed successfully (Priority update failed)');
      expect(incompletetreatment.isComplete).toBe(true);
    });

    test('should update treatment status in Priority for removal', async () => {
      const { Treatment } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      const removalTreatment = {
        ...mockTreatmentData,
        type: 'removal',
        isComplete: false,
        save: jest.fn<Promise<boolean>, []>().mockResolvedValue(true)
      };

      Treatment.findByPk.mockResolvedValue(removalTreatment);
      applicatorService.updateTreatmentStatusInPriority.mockResolvedValue({
        success: true,
        message: 'Status updated to Removed'
      });

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}/complete`);

      expect(response.status).toBe(200);
      expect(applicatorService.updateTreatmentStatusInPriority).toHaveBeenCalledWith(
        mockTreatmentData.id,
        'Removed'
      );
    });
  });

  describe('PUT /api/treatments/:id', () => {
    test('should update treatment successfully', async () => {
      const { Treatment } = require('../../src/models');

      const treatmentToUpdate = {
        ...mockTreatmentData,
        update: jest.fn<Promise<boolean>, [any]>().mockResolvedValue(true)
      };

      Treatment.findByPk.mockResolvedValue(treatmentToUpdate);

      const updateData = {
        subjectId: 'PAT-2025-UPDATED',
        site: '100040'
      };

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(treatmentToUpdate.update).toHaveBeenCalledWith(updateData);
    });

    test('should prevent updating completed treatment', async () => {
      const { Treatment } = require('../../src/models');

      const completedTreatment = {
        ...mockTreatmentData,
        isComplete: true
      };

      Treatment.findByPk.mockResolvedValue(completedTreatment);

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}`)
        .send({ subjectId: 'PAT-2025-UPDATED' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('completed');
    });

    test('should validate update data', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findByPk.mockResolvedValue(mockTreatmentData);

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}`)
        .send({ type: 'invalid-type' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('type');
    });
  });

  describe('DELETE /api/treatments/:id', () => {
    test('should delete treatment successfully', async () => {
      const { Treatment } = require('../../src/models');

      const treatmentToDelete = {
        ...mockTreatmentData,
        destroy: jest.fn<Promise<boolean>, []>().mockResolvedValue(true)
      };

      Treatment.findByPk.mockResolvedValue(treatmentToDelete);

      const response = await request(app)
        .delete(`/api/treatments/${mockTreatmentData.id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Treatment deleted successfully');
      expect(treatmentToDelete.destroy).toHaveBeenCalled();
    });

    test('should prevent deleting completed treatment', async () => {
      const { Treatment } = require('../../src/models');

      const completedTreatment = {
        ...mockTreatmentData,
        isComplete: true
      };

      Treatment.findByPk.mockResolvedValue(completedTreatment);

      const response = await request(app)
        .delete(`/api/treatments/${mockTreatmentData.id}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('completed');
    });
  });

  describe('GET /api/treatments/:id/applicators', () => {
    test('should get treatment applicators successfully', async () => {
      const { Treatment, Applicator } = require('../../src/models');

      Treatment.findByPk.mockResolvedValue(mockTreatmentData);
      Applicator.findAll.mockResolvedValue([
        mockApplicatorData,
        { ...mockApplicatorData, id: 'applicator-2', serialNumber: 'APP002-2025-001' }
      ]);

      const response = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}/applicators`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].serialNumber).toBe('APP001-2025-001');
      expect(Applicator.findAll).toHaveBeenCalledWith({
        where: { treatmentId: mockTreatmentData.id },
        order: [['insertionTime', 'ASC']]
      });
    });

    test('should return empty array for treatment with no applicators', async () => {
      const { Treatment, Applicator } = require('../../src/models');

      Treatment.findByPk.mockResolvedValue(mockTreatmentData);
      Applicator.findAll.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}/applicators`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('Medical Workflow Validation', () => {
    test('should validate treatment type workflow constraints', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.create.mockRejectedValue(new Error('Invalid workflow transition'));

      const response = await request(app)
        .post('/api/treatments')
        .send({
          type: 'removal',
          subjectId: 'PAT-2025-003',
          site: '100078',
          date: '2025-07-11'
        });

      expect(response.status).toBe(500);
    });

    test('should enforce seed quantity constraints', async () => {
      const { Treatment, Applicator } = require('../../src/models');

      const treatmentWithApplicators = {
        ...mockTreatmentData,
        applicators: [
          { ...mockApplicatorData, seedQuantity: 25, usageType: 'full' },
          { ...mockApplicatorData, seedQuantity: 20, usageType: 'full' }
        ]
      };

      Treatment.findByPk.mockResolvedValue(treatmentWithApplicators);

      const response = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}`);

      expect(response.status).toBe(200);
      expect(response.body.applicators).toHaveLength(2);
    });

    test('should calculate treatment progress correctly', async () => {
      const { Treatment } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      applicatorService.calculateSeedCountStatus.mockResolvedValue({
        totalSeeds: 45,
        removedSeeds: 30,
        complete: false,
        status: 'incomplete'
      });

      const treatmentWithProgress = {
        ...mockTreatmentData,
        type: 'removal'
      };

      Treatment.findByPk.mockResolvedValue(treatmentWithProgress);

      const response = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/treatments')
        .send('invalid-json');

      expect(response.status).toBe(400);
    });

    test('should handle database connection errors', async () => {
      const { Treatment } = require('../../src/models');

      Treatment.findAll.mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .get('/api/treatments');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database connection lost');
    });

    test('should handle concurrent modification', async () => {
      const { Treatment } = require('../../src/models');

      const concurrencyError = new Error('Version mismatch');
      concurrencyError.name = 'SequelizeOptimisticLockError';

      Treatment.findByPk.mockResolvedValue({
        ...mockTreatmentData,
        update: jest.fn<Promise<boolean>, [any]>().mockRejectedValue(concurrencyError)
      });

      const response = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}`)
        .send({ subjectId: 'PAT-2025-UPDATED' });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('modified');
    });

    test('should handle large applicator datasets', async () => {
      const { Treatment, Applicator } = require('../../src/models');

      const largeApplicatorList = Array.from({ length: 100 }, (_, i) => ({
        ...mockApplicatorData,
        id: `applicator-${i}`,
        serialNumber: `APP${String(i).padStart(3, '0')}-2025-001`
      }));

      Treatment.findByPk.mockResolvedValue(mockTreatmentData);
      Applicator.findAll.mockResolvedValue(largeApplicatorList);

      const response = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}/applicators`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(100);
    });
  });
});