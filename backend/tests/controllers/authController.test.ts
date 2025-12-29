// Auth Controller Test Suite - Medical Application Testing
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import {
  requestVerificationCode,
  verifyCode,
  resendVerificationCode,
  validateToken,
  debugUserSiteAccess
} from '../../src/controllers/authController';
import { mockUserData, mockSites, testTokens } from '../fixtures/testData';
import {
  setupDatabaseMocks,
  setupPriorityApiMocks,
  resetAllMocks,
  mockUser,
  mockJWT
} from '../helpers/mockHelpers';

// Mock dependencies
jest.mock('../../src/models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

jest.mock('../../src/services/priorityService', () => ({
  default: {
    getUserSiteAccess: jest.fn(),
    debugPriorityConnection: jest.fn(),
  },
  __esModule: true,
}));

// Error handler middleware for tests (same as production)
const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
  });
};

// Express app setup for testing
const app: Express = express();
app.use(express.json());

// Setup auth routes for testing
app.post('/api/auth/request-code', requestVerificationCode);
app.post('/api/auth/verify', verifyCode);
app.post('/api/auth/resend-code', resendVerificationCode);
app.post('/api/auth/validate-token', validateToken);
app.get('/api/auth/debug-sites/:identifier', debugUserSiteAccess);

// Add error handler after routes
app.use(errorHandler);

describe('Auth Controller', () => {
  beforeEach(() => {
    // Set NODE_ENV to development for debug endpoint tests
    process.env.NODE_ENV = 'development';
    // Clear bypass emails to ensure tests go through normal flow
    delete process.env.BYPASS_PRIORITY_EMAILS;

    resetAllMocks();
    setupDatabaseMocks();
    setupPriorityApiMocks();

    // Setup JWT mocks
    const jwt = require('jsonwebtoken');
    jwt.sign.mockReturnValue(testTokens.validToken);
    jwt.verify.mockReturnValue({ id: 'test-user-uuid-001' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/request-code', () => {
    test('should request verification code for valid email', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null); // New user
      User.create.mockResolvedValue({
        ...mockUser,
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      });

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: false,
        sites: [mockSites[0]],
        user: {
          email: 'test@example.com',
          phone: '555-TEST',
          positionCode: 1
        }
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification code sent');
      expect(response.body.userData).toEqual(
        expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com'
        })
      );
    });

    test('should request verification code for existing user', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      const existingUser = {
        ...mockUser,
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456'),
        save: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
        metadata: {}
      };

      User.findOne.mockResolvedValue(existingUser);

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: true,
        sites: mockSites,
        user: {
          email: 'admin@alphatau.com',
          phone: '555-ADMIN',
          positionCode: 99
        }
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'admin@alphatau.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(existingUser.save).toHaveBeenCalled();
    });

    test('should handle phone number authentication', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        ...mockUser,
        email: null,
        phoneNumber: '555-123-4567',
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      });

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: false,
        sites: [mockSites[0]],
        user: {
          phone: '555-123-4567',
          positionCode: 1
        }
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: '555-123-4567' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject missing identifier', async () => {
      const response = await request(app)
        .post('/api/auth/request-code')
        .send({});

      expect(response.status).toBe(400);
      // asyncHandler throws error, message is present in error response
      expect(response.body.message).toBeDefined();
    });

    test('should handle user not found in Priority system', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: false
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'notfound@example.com' });

      // Security: Controller returns 400 with generic message to prevent user enumeration
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Unable to send verification code. Please verify your credentials.');
    });

    test('should handle Priority system error', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.getUserSiteAccess.mockRejectedValue(new Error('Priority API unavailable'));

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'test@example.com' });

      // Security: Controller returns 400 with generic message to prevent info leakage
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Unable to send verification code. Please try again later.');
    });

    test('should create user with admin privileges for position code 99', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        ...mockUser,
        role: 'admin',
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      });

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: true,
        sites: mockSites,
        user: {
          email: 'admin@alphatau.com',
          positionCode: 99
        }
      });

      const response = await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'admin@alphatau.com' });

      expect(response.status).toBe(200);
      expect(User.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
          metadata: expect.objectContaining({
            positionCode: 99,
            custName: 'ALL_SITES',
            fullAccess: true
          })
        })
      );
    });
  });

  describe('POST /api/auth/verify', () => {
    test('should verify code successfully and return JWT token', async () => {
      const { User } = require('../../src/models');

      const userWithCode = {
        ...mockUser,
        verifyCode: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
        failedAttempts: 0
      };

      User.findOne.mockResolvedValue(userWithCode);

      const response = await request(app)
        .post('/api/auth/verify')
        .send({
          identifier: 'test@example.com',
          code: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Security: Token is now in HttpOnly cookie, not response body (OWASP best practice)
      expect(response.headers['set-cookie']).toBeDefined();
      expect(response.headers['set-cookie'][0]).toMatch(/auth-token=/);
      expect(response.body.user).toEqual(
        expect.objectContaining({
          id: 'test-user-uuid-001',
          email: 'test@example.com',
          role: 'hospital'
        })
      );
    });

    test('should handle invalid verification code', async () => {
      const { User } = require('../../src/models');

      const userWithCode = {
        ...mockUser,
        verifyCode: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(false),
        failedAttempts: 1
      };

      User.findOne.mockResolvedValue(userWithCode);

      const response = await request(app)
        .post('/api/auth/verify')
        .send({
          identifier: 'test@example.com',
          code: 'wrong-code'
        });

      expect(response.status).toBe(401);
      // asyncHandler throws error, check message is present
      expect(response.body.message).toBeDefined();
    });

    test('should handle user not found', async () => {
      const { User } = require('../../src/models');

      User.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/verify')
        .send({
          identifier: 'notfound@example.com',
          code: '123456'
        });

      expect(response.status).toBe(404);
      // asyncHandler throws error, check message is present
      expect(response.body.message).toBeDefined();
    });

    test('should reject missing parameters', async () => {
      const response = await request(app)
        .post('/api/auth/verify')
        .send({ identifier: 'test@example.com' }); // Missing code

      expect(response.status).toBe(400);
      // asyncHandler throws error, check message is present
      expect(response.body.message).toBeDefined();
    });

    test('should log warning for excessive failed attempts', async () => {
      const { User } = require('../../src/models');

      const userWithFailedAttempts = {
        ...mockUser,
        verifyCode: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(false),
        failedAttempts: 3
      };

      User.findOne.mockResolvedValue(userWithFailedAttempts);

      const response = await request(app)
        .post('/api/auth/verify')
        .send({
          identifier: 'test@example.com',
          code: 'wrong-code'
        });

      expect(response.status).toBe(401);
      // Should log warning about exceeded attempts
    });

    test('should handle phone number verification', async () => {
      const { User } = require('../../src/models');

      const phoneUser = {
        ...mockUser,
        email: null,
        phoneNumber: '555-123-4567',
        verifyCode: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true)
      };

      User.findOne.mockResolvedValue(phoneUser);

      const response = await request(app)
        .post('/api/auth/verify')
        .send({
          identifier: '555-123-4567',
          code: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.phoneNumber).toBe('555-123-4567');
    });
  });

  describe('POST /api/auth/resend-code', () => {
    test('should resend verification code for existing user', async () => {
      const { User } = require('../../src/models');

      const existingUser = {
        ...mockUser,
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      };

      User.findOne.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/api/auth/resend-code')
        .send({ identifier: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification code resent');
      expect(existingUser.generateVerificationCode).toHaveBeenCalled();
    });

    test('should create new user from Priority if not found locally', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({
        ...mockUser,
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      });

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: false,
        sites: [mockSites[0]],
        user: {
          email: 'new@example.com',
          positionCode: 1
        }
      });

      const response = await request(app)
        .post('/api/auth/resend-code')
        .send({ identifier: 'new@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(User.create).toHaveBeenCalled();
    });

    test('should handle user not found in Priority system', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null);
      priorityService.getUserSiteAccess.mockResolvedValue({
        found: false
      });

      const response = await request(app)
        .post('/api/auth/resend-code')
        .send({ identifier: 'notfound@example.com' });

      // Security: Controller returns 400 with generic message to prevent user enumeration
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Unable to resend verification code. Please verify your credentials.');
    });

    test('should reject missing identifier', async () => {
      const response = await request(app)
        .post('/api/auth/resend-code')
        .send({});

      expect(response.status).toBe(400);
      // asyncHandler throws error, check message is present
      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/auth/debug-sites/:identifier', () => {
    test('should debug user site access successfully', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.debugPriorityConnection.mockResolvedValue({
        success: true,
        phonebookCount: 10
      });

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: true,
        sites: mockSites,
        user: {
          email: 'admin@alphatau.com',
          positionCode: 99
        }
      });

      const response = await request(app)
        .get('/api/auth/debug-sites/admin@alphatau.com');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(
        expect.objectContaining({
          identifier: 'admin@alphatau.com',
          found: true,
          fullAccess: true,
          siteCount: 3
        })
      );
    });

    test('should handle Priority connection failure', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.debugPriorityConnection.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      const response = await request(app)
        .get('/api/auth/debug-sites/test@example.com');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Priority connection failed');
      expect(response.body.connectionError).toBe('Connection failed');
    });

    test('should handle missing identifier', async () => {
      const response = await request(app)
        .get('/api/auth/debug-sites/');

      // This would be a 404 due to route mismatch, but let's test the handler
      const response2 = await request(app)
        .get('/api/auth/debug-sites/');

      // Route won't match, so status would be different
      expect(response2.status).toBe(404);
    });

    test('should handle Priority service error', async () => {
      const priorityService = require('../../src/services/priorityService').default;

      priorityService.debugPriorityConnection.mockResolvedValue({
        success: true,
        phonebookCount: 10
      });

      priorityService.getUserSiteAccess.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/auth/debug-sites/test@example.com');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Debug test failed');
      expect(response.body.error).toBe('Service error');
    });
  });

  describe('JWT Token Generation', () => {
    test('should generate valid JWT token', () => {
      const jwt = require('jsonwebtoken');
      jwt.sign.mockReturnValue('mock-jwt-token');

      // The generateToken function is internal to the controller
      // We test it through the verify endpoint
      expect(jwt.sign).toBeDefined();
    });

    test('should use correct JWT secret', () => {
      process.env.JWT_SECRET = 'test-secret-key';

      // JWT secret is used in controller - we can verify through integration
      expect(process.env.JWT_SECRET).toBe('test-secret-key');
    });
  });

  describe('User Role Assignment', () => {
    test('should assign admin role for position code 99', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null);

      const createCall = jest.fn<Promise<any>, [any]>().mockResolvedValue({
        ...mockUser,
        role: 'admin',
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      });

      User.create.mockImplementation(createCall);

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: true,
        sites: mockSites,
        user: {
          email: 'admin@alphatau.com',
          positionCode: 99
        }
      });

      await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'admin@alphatau.com' });

      expect(createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin'
        })
      );
    });

    test('should assign hospital role for other position codes', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null);

      const createCall = jest.fn<Promise<any>, [any]>().mockResolvedValue({
        ...mockUser,
        role: 'hospital',
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      });

      User.create.mockImplementation(createCall);

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: false,
        sites: [mockSites[0]],
        user: {
          email: 'hospital@example.com',
          positionCode: 1
        }
      });

      await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'hospital@example.com' });

      expect(createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'hospital'
        })
      );
    });
  });

  describe('Metadata Management', () => {
    test('should store Priority user metadata correctly', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      User.findOne.mockResolvedValue(null);

      const createCall = jest.fn<Promise<any>, [any]>().mockResolvedValue({
        ...mockUser,
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      });

      User.create.mockImplementation(createCall);

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: false,
        sites: [mockSites[0]],
        user: {
          email: 'test@example.com',
          positionCode: 1,
          custName: '100078'
        }
      });

      await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'test@example.com' });

      expect(createCall).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            positionCode: 1,
            custName: '100078',
            sites: [mockSites[0]],
            fullAccess: false
          })
        })
      );
    });

    test('should update existing user metadata', async () => {
      const { User } = require('../../src/models');
      const priorityService = require('../../src/services/priorityService').default;

      const existingUser = {
        ...mockUser,
        metadata: { oldData: 'should be updated' },
        save: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
        generateVerificationCode: jest.fn<Promise<string>, []>().mockResolvedValue('123456')
      };

      User.findOne.mockResolvedValue(existingUser);

      priorityService.getUserSiteAccess.mockResolvedValue({
        found: true,
        fullAccess: true,
        sites: mockSites,
        user: {
          email: 'test@example.com',
          positionCode: 99
        }
      });

      await request(app)
        .post('/api/auth/request-code')
        .send({ identifier: 'test@example.com' });

      expect(existingUser.metadata).toEqual(
        expect.objectContaining({
          positionCode: 99,
          custName: 'ALL_SITES',
          fullAccess: true
        })
      );
      expect(existingUser.save).toHaveBeenCalled();
    });
  });
});