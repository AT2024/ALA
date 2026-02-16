/**
 * Tests for HIPAA 2025 Authentication Audit Service
 */

// Mock the AuthAuditLog model
const mockCreate = jest.fn();
jest.mock('../../../src/models', () => ({
  AuthAuditLog: {
    create: mockCreate,
  },
}));

// Import after setting up mocks
// Note: logger is already mocked in tests/setup.ts
import { authAuditService } from '../../../src/services/authAuditService';
import logger from '../../../src/utils/logger';

describe('AuthAuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({});
  });

  describe('maskIdentifier', () => {
    it('should mask email addresses correctly', () => {
      expect(authAuditService.maskIdentifier('user@example.com')).toBe('us***@example.com');
      expect(authAuditService.maskIdentifier('ab@test.com')).toBe('a***@test.com');
      expect(authAuditService.maskIdentifier('x@y.com')).toBe('x***@y.com');
    });

    it('should mask phone numbers correctly', () => {
      expect(authAuditService.maskIdentifier('555-123-4567')).toBe('555-***-4567');
      expect(authAuditService.maskIdentifier('1234567890')).toBe('123-***-7890');
      expect(authAuditService.maskIdentifier('+1 (555) 123-4567')).toBe('155-***-4567');
    });

    it('should mask short identifiers', () => {
      expect(authAuditService.maskIdentifier('ab')).toBe('a***');
      expect(authAuditService.maskIdentifier('abcd')).toBe('a***');
      expect(authAuditService.maskIdentifier('abcde')).toBe('ab***de');
    });

    it('should return null for null/undefined input', () => {
      expect(authAuditService.maskIdentifier(null)).toBeNull();
      expect(authAuditService.maskIdentifier(undefined)).toBeNull();
    });
  });

  describe('logLoginSuccess', () => {
    it('should create audit log entry with correct event type', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await authAuditService.logLoginSuccess(userId, ipAddress, userAgent);

      expect(mockCreate).toHaveBeenCalledWith({
        userId,
        eventType: 'LOGIN_SUCCESS',
        ipAddress,
        userAgent,
        requestId: null,
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('LOGIN_SUCCESS'));
    });

    it('should handle missing optional parameters', async () => {
      const userId = 'user-123';

      await authAuditService.logLoginSuccess(userId);

      expect(mockCreate).toHaveBeenCalledWith({
        userId,
        eventType: 'LOGIN_SUCCESS',
        ipAddress: null,
        userAgent: null,
        requestId: null,
      });
    });

    it('should not throw on database error', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(authAuditService.logLoginSuccess('user-123')).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logLoginFailure', () => {
    it('should create audit log entry with masked identifier', async () => {
      const identifier = 'user@example.com';
      const reason = 'Invalid verification code';
      const ipAddress = '192.168.1.1';

      await authAuditService.logLoginFailure(identifier, reason, ipAddress);

      expect(mockCreate).toHaveBeenCalledWith({
        eventType: 'LOGIN_FAILURE',
        identifier: 'us***@example.com', // Masked
        failureReason: reason,
        ipAddress,
        userAgent: null,
        requestId: null,
      });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('LOGIN_FAILURE'));
    });

    it('should not throw on database error', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      await expect(
        authAuditService.logLoginFailure('user@example.com', 'Invalid code')
      ).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logLogout', () => {
    it('should create audit log entry with correct event type', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await authAuditService.logLogout(userId, ipAddress, userAgent);

      expect(mockCreate).toHaveBeenCalledWith({
        userId,
        eventType: 'LOGOUT',
        ipAddress,
        userAgent,
        requestId: null,
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('LOGOUT'));
    });

    it('should not throw on database error', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      await expect(authAuditService.logLogout('user-123')).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logSessionTimeout', () => {
    it('should create audit log entry with correct event type', async () => {
      const userId = 'user-123';

      await authAuditService.logSessionTimeout(userId);

      expect(mockCreate).toHaveBeenCalledWith({
        userId,
        eventType: 'SESSION_TIMEOUT',
        requestId: null,
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('SESSION_TIMEOUT'));
    });

    it('should include requestId when provided', async () => {
      const userId = 'user-123';
      const requestId = 'req-456';

      await authAuditService.logSessionTimeout(userId, requestId);

      expect(mockCreate).toHaveBeenCalledWith({
        userId,
        eventType: 'SESSION_TIMEOUT',
        requestId,
      });
    });

    it('should not throw on database error', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      await expect(authAuditService.logSessionTimeout('user-123')).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('logOtpRequest', () => {
    it('should create audit log entry with masked identifier', async () => {
      const identifier = '555-123-4567';
      const ipAddress = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      await authAuditService.logOtpRequest(identifier, ipAddress, userAgent);

      expect(mockCreate).toHaveBeenCalledWith({
        eventType: 'OTP_REQUEST',
        identifier: '555-***-4567', // Masked
        ipAddress,
        userAgent,
        requestId: null,
      });
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('OTP_REQUEST'));
    });

    it('should not throw on database error', async () => {
      mockCreate.mockRejectedValue(new Error('Database error'));

      await expect(
        authAuditService.logOtpRequest('user@example.com')
      ).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
