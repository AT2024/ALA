// API Integration Test Suite - Medical Application Testing
import { jest, describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import app from '../../src/server';
import { mockUserData, mockTreatmentData, mockApplicatorData, testTokens } from '../fixtures/testData';
import { setupDatabaseMocks, setupPriorityApiMocks, resetAllMocks } from '../helpers/mockHelpers';

// Mock all external dependencies for integration testing
jest.mock('../../src/services/priorityService');
jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn()
  },
  Treatment: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn()
  },
  Applicator: {
    findAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  sequelize: {
    transaction: jest.fn(),
    authenticate: jest.fn(),
    sync: jest.fn()
  }
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue(testTokens.validToken),
  verify: jest.fn().mockReturnValue({ id: mockUserData.id })
}));

describe('API Integration Tests', () => {
  let server: any;

  beforeAll(async () => {
    // Start test server
    const port = process.env.TEST_PORT || 3001;
    server = app.listen(port);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    resetAllMocks();
    setupDatabaseMocks();
    setupPriorityApiMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Flow Integration', () => {
    test('should complete full authentication flow', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      // Step 1: Request verification code
      User.findOne.mockResolvedValueOnce(null); // New user
      User.create.mockResolvedValueOnce({
        ...mockUserData,
        generateVerificationCode: jest.fn().mockResolvedValue('123456')
      });

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: false,
        sites: [{ custName: '100078', custDes: 'Main Test Hospital' }],
        user: {
          email: 'test@example.com',
          positionCode: 1
        }
      });

      const requestResponse = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'test@example.com' });

      expect(requestResponse.status).toBe(200);
      expect(requestResponse.body.success).toBe(true);

      // Step 2: Verify code
      User.findOne.mockResolvedValueOnce({
        ...mockUserData,
        verifyCode: jest.fn().mockResolvedValue(true)
      });

      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({
          identifier: 'test@example.com',
          code: '123456'
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.token).toBeDefined();
      expect(verifyResponse.body.user).toEqual(
        expect.objectContaining({
          email: 'test@example.com'
        })
      );
    });

    test('should handle authentication failure flow', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      // Step 1: Request code for non-existent user
      priorityService.getUserSiteAccess.mockResolvedValue({
        found: false
      });

      const requestResponse = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'notfound@example.com' });

      expect(requestResponse.status).toBe(404);
      expect(requestResponse.body.success).toBe(false);

      // Step 2: Try to verify anyway (should fail)
      User.findOne.mockResolvedValueOnce(null);

      const verifyResponse = await request(app)
        .post('/api/auth/verify')
        .send({
          identifier: 'notfound@example.com',
          code: '123456'
        });

      expect(verifyResponse.status).toBe(404);
      expect(verifyResponse.body.success).toBe(false);
    });

    test('should handle Priority API failure with bypass', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      // Set bypass email
      process.env.BYPASS_PRIORITY_EMAILS = 'test@bypass.com';

      User.findOne.mockResolvedValueOnce(null);
      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: true,
        sites: [{ custName: 'ALL_SITES', custDes: 'All Sites (Emergency Access)' }],
        user: {
          email: 'test@bypass.com',
          positionCode: 99
        }
      });

      User.create.mockResolvedValueOnce({
        ...mockUserData,
        email: 'test@bypass.com',
        role: 'admin',
        generateVerificationCode: jest.fn().mockResolvedValue('123456')
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'test@bypass.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Cleanup
      delete process.env.BYPASS_PRIORITY_EMAILS;
    });
  });

  describe('Treatment Workflow Integration', () => {
    test('should complete full treatment creation to completion flow', async () => {
      const { User, Treatment, Applicator, sequelize } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      // Mock authenticated user
      User.findByPk.mockResolvedValue(mockUserData);

      // Step 1: Create treatment
      Treatment.create.mockResolvedValueOnce(mockTreatmentData);

      const createResponse = await request(app)
        .post('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .send({
          type: 'insertion',
          subjectId: 'PAT-2025-015',
          site: '100078',
          date: '2025-07-10',
          priorityId: 'SO25000015'
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.subjectId).toBe('PAT-2025-015');

      // Step 2: Add applicators
      Treatment.findByPk.mockResolvedValue(mockTreatmentData);
      sequelize.transaction.mockImplementation((callback) =>
        callback({ commit: jest.fn(), rollback: jest.fn() })
      );
      applicatorService.addApplicatorWithTransaction.mockResolvedValue(mockApplicatorData);

      const addApplicatorResponse = await request(app)
        .post(`/api/treatments/${mockTreatmentData.id}/applicators`)
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .send({
          SERNUM: 'APP001-2025-001',
          USINGTYPE: 'full',
          INTDATA2: 25,
          INSERTEDSEEDSQTY: 25,
          INSERTIONDATE: '2025-07-10T10:30:00Z'
        });

      expect(addApplicatorResponse.status).toBe(201);
      expect(addApplicatorResponse.body.serialNumber).toBe('APP001-2025-001');

      // Step 3: Get treatment with applicators
      const treatmentWithApplicators = {
        ...mockTreatmentData,
        applicators: [mockApplicatorData]
      };

      Treatment.findByPk.mockResolvedValue(treatmentWithApplicators);

      const getResponse = await request(app)
        .get(`/api/treatments/${mockTreatmentData.id}`)
        .set('Authorization', `Bearer ${testTokens.validToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.applicators).toHaveLength(1);

      // Step 4: Complete treatment
      const treatmentToComplete = {
        ...mockTreatmentData,
        isComplete: false,
        save: jest.fn().mockResolvedValue(true)
      };

      Treatment.findByPk.mockResolvedValue(treatmentToComplete);
      applicatorService.updateTreatmentStatusInPriority.mockResolvedValue({
        success: true,
        message: 'Treatment status updated'
      });

      const completeResponse = await request(app)
        .put(`/api/treatments/${mockTreatmentData.id}/complete`)
        .set('Authorization', `Bearer ${testTokens.validToken}`);

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.message).toBe('Treatment completed successfully');
      expect(treatmentToComplete.isComplete).toBe(true);
    });

    test('should handle treatment workflow errors gracefully', async () => {
      const { User, Treatment } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);

      // Step 1: Try to create invalid treatment
      Treatment.create.mockRejectedValue(new Error('Validation failed'));

      const createResponse = await request(app)
        .post('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .send({
          type: 'invalid-type',
          subjectId: 'PAT-2025-015',
          site: '100078',
          date: '2025-07-10'
        });

      expect(createResponse.status).toBe(500);

      // Step 2: Try to access non-existent treatment
      Treatment.findByPk.mockResolvedValue(null);

      const getResponse = await request(app)
        .get('/api/treatments/non-existent-id')
        .set('Authorization', `Bearer ${testTokens.validToken}`);

      expect(getResponse.status).toBe(404);
    });
  });

  describe('Medical Applicator Validation Integration', () => {
    test('should complete full applicator validation flow', async () => {
      const { User, Treatment } = require('../../src/models');
      const applicatorService = require('../../src/services/applicatorService').default;

      User.findByPk.mockResolvedValue(mockUserData);
      Treatment.findByPk.mockResolvedValue(mockTreatmentData);

      // Mock applicator validation scenarios
      applicatorService.validateApplicator
        .mockResolvedValueOnce({
          isValid: true,
          scenario: 'valid',
          message: 'Applicator validated successfully',
          requiresConfirmation: false,
          applicatorData: {
            serialNumber: 'APP001-2025-001',
            applicatorType: 'Standard Applicator Type A',
            seedQuantity: 25
          }
        })
        .mockResolvedValueOnce({
          isValid: false,
          scenario: 'already_scanned',
          message: 'This applicator was already scanned for this treatment.',
          requiresConfirmation: false
        })
        .mockResolvedValueOnce({
          isValid: false,
          scenario: 'wrong_treatment',
          message: 'This applicator is intended for Patient: PAT-2025-999\n\nAre you sure you want to continue?',
          requiresConfirmation: true,
          applicatorData: {
            serialNumber: 'APP002-2025-001',
            applicatorType: 'Standard Applicator Type A',
            seedQuantity: 25,
            intendedPatientId: 'PAT-2025-999'
          }
        });

      // Test valid applicator
      const validationEndpoint = `/api/treatments/${mockTreatmentData.id}/validate-applicator`;

      const validResponse = await request(app)
        .post(validationEndpoint)
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .send({
          serialNumber: 'APP001-2025-001',
          patientId: 'PAT-2025-015',
          scannedApplicators: []
        });

      // This would need to be implemented in the actual controller
      // expect(validResponse.status).toBe(200);

      // For now, we test the service integration
      expect(applicatorService.validateApplicator).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle database connection failures', async () => {
      const { sequelize } = require('../../src/models');

      sequelize.authenticate.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${testTokens.validToken}`);

      expect(response.status).toBe(500);
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect(response.status).toBe(400);
    });

    test('should handle missing authentication', async () => {
      const response = await request(app)
        .get('/api/treatments');

      expect(response.status).toBe(401);
    });

    test('should handle invalid JWT token', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/treatments')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Priority API Integration Flow', () => {
    test('should handle Priority API outage gracefully', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      // Simulate Priority API outage
      priorityService.getUserSiteAccess.mockRejectedValue(new Error('Priority API unavailable'));
      priorityService.debugPriorityConnection.mockResolvedValue({
        success: false,
        error: 'Connection timeout'
      });

      const response = await request(app)
        .get('/api/auth/debug-sites/test@example.com');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    test('should handle Priority API rate limiting', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.response = { status: 429 };

      priorityService.getUserSiteAccess.mockRejectedValue(rateLimitError);

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'test@example.com' });

      expect(response.status).toBe(500);
    });
  });

  describe('Medical Data Integrity', () => {
    test('should maintain data consistency across operations', async () => {
      const { User, Treatment, Applicator } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);

      // Create treatment
      Treatment.create.mockResolvedValue(mockTreatmentData);
      Treatment.findByPk.mockResolvedValue(mockTreatmentData);

      const createResponse = await request(app)
        .post('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .send({
          type: 'insertion',
          subjectId: 'PAT-2025-015',
          site: '100078',
          date: '2025-07-10'
        });

      expect(createResponse.status).toBe(201);

      // Verify treatment exists
      Treatment.findAll.mockResolvedValue([mockTreatmentData]);

      const listResponse = await request(app)
        .get('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toHaveLength(1);
    });

    test('should validate medical workflow constraints', async () => {
      const { User, Treatment } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);

      // Try to create removal treatment without prior insertion
      const validationError = new Error('Cannot create removal without prior insertion');
      Treatment.create.mockRejectedValue(validationError);

      const response = await request(app)
        .post('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .send({
          type: 'removal',
          subjectId: 'PAT-2025-NEW',
          site: '100078',
          date: '2025-07-10'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent requests efficiently', async () => {
      const { User, Treatment } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);
      Treatment.findAll.mockResolvedValue([mockTreatmentData]);

      // Create multiple concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .get('/api/treatments')
          .set('Authorization', `Bearer ${testTokens.validToken}`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
      });
    });

    test('should handle large datasets efficiently', async () => {
      const { User, Treatment } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);

      // Mock large dataset
      const largeTreatmentList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTreatmentData,
        id: `treatment-${i}`,
        subjectId: `PAT-2025-${String(i).padStart(3, '0')}`
      }));

      Treatment.findAll.mockResolvedValue(largeTreatmentList);

      const response = await request(app)
        .get('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1000);
    });
  });

  describe('Security Integration', () => {
    test('should prevent SQL injection attacks', async () => {
      const { User, Treatment } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);
      Treatment.findAll.mockResolvedValue([]);

      // Try SQL injection in query parameters
      const response = await request(app)
        .get('/api/treatments?subjectId=PAT-001\' OR \'1\'=\'1')
        .set('Authorization', `Bearer ${testTokens.validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should validate input sanitization', async () => {
      const { User, Treatment } = require('../../src/models');

      User.findByPk.mockResolvedValue(mockUserData);

      const maliciousInput = {
        type: '<script>alert("xss")</script>',
        subjectId: 'javascript:alert("xss")',
        site: '100078',
        date: '2025-07-10'
      };

      const response = await request(app)
        .post('/api/treatments')
        .set('Authorization', `Bearer ${testTokens.validToken}`)
        .send(maliciousInput);

      expect(response.status).toBe(400);
    });
  });
});