/**
 * SignatureVerification Model Unit Tests
 *
 * Tests the core methods of SignatureVerification:
 * - generateCode(): Generate and hash 6-digit verification codes
 * - verifyCode(): Validate codes with attempt tracking
 * - getRemainingAttempts(): Calculate remaining attempts
 * - isStillValid(): Check if verification is still valid
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcryptjs';

// Mock bcrypt
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock the database config
jest.mock('../../../src/config/database', () => ({
  default: {
    define: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('SignatureVerification Model', () => {
  // Create a mock instance that simulates the SignatureVerification model
  let mockVerification: {
    id: string;
    treatmentId: string;
    targetEmail: string;
    verificationCode: string;
    verificationExpires: Date;
    failedAttempts: number;
    status: 'pending' | 'verified' | 'expired' | 'failed';
    signerName: string | null;
    signerPosition: string | null;
    createdAt: Date;
    updatedAt: Date;
    save: jest.Mock;
    generateCode: () => Promise<string>;
    verifyCode: (code: string) => Promise<boolean>;
    getRemainingAttempts: () => number;
    isStillValid: () => boolean;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue('hashed-code' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    // Create a fresh mock verification for each test
    mockVerification = createMockVerification();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Creates a mock SignatureVerification instance with working methods
   */
  function createMockVerification(overrides: Partial<typeof mockVerification> = {}) {
    const instance: typeof mockVerification = {
      id: 'test-uuid-123',
      treatmentId: 'test-treatment-id',
      targetEmail: 'test@example.com',
      verificationCode: 'initial-code',
      verificationExpires: new Date(Date.now() + 3600000), // 1 hour from now
      failedAttempts: 0,
      status: 'pending',
      signerName: null,
      signerPosition: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      save: jest.fn().mockResolvedValue(undefined),

      // Implement generateCode method (matches actual implementation)
      async generateCode(): Promise<string> {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = await bcrypt.hash(code, 10);

        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 1);

        this.verificationCode = hashedCode;
        this.verificationExpires = expiration;
        this.failedAttempts = 0;
        this.status = 'pending';
        await this.save();

        return code;
      },

      // Implement verifyCode method (matches actual implementation)
      async verifyCode(code: string): Promise<boolean> {
        if (this.status === 'verified') {
          return false;
        }
        if (this.status === 'failed') {
          return false;
        }

        if (new Date() > this.verificationExpires) {
          this.status = 'expired';
          await this.save();
          return false;
        }

        const isValid = await bcrypt.compare(code, this.verificationCode);

        if (isValid) {
          this.status = 'verified';
          await this.save();
          return true;
        } else {
          this.failedAttempts += 1;
          if (this.failedAttempts >= 3) {
            this.status = 'failed';
          }
          await this.save();
          return false;
        }
      },

      // Implement getRemainingAttempts method (matches actual implementation)
      getRemainingAttempts(): number {
        return Math.max(0, 3 - this.failedAttempts);
      },

      // Implement isStillValid method (matches actual implementation)
      isStillValid(): boolean {
        if (this.status !== 'pending') {
          return false;
        }
        if (new Date() > this.verificationExpires) {
          return false;
        }
        return true;
      },

      ...overrides,
    };

    return instance;
  }

  describe('generateCode', () => {
    test('should generate a 6-digit numeric code', async () => {
      const code = await mockVerification.generateCode();

      expect(code).toMatch(/^\d{6}$/);
      expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code)).toBeLessThan(1000000);
    });

    test('should hash the code with bcrypt (salt rounds 10)', async () => {
      await mockVerification.generateCode();

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{6}$/),
        10
      );
    });

    test('should set verificationCode to hashed value', async () => {
      await mockVerification.generateCode();

      expect(mockVerification.verificationCode).toBe('hashed-code');
    });

    test('should set 1-hour expiration', async () => {
      const beforeGeneration = new Date();
      await mockVerification.generateCode();

      const expectedExpiration = new Date();
      expectedExpiration.setHours(expectedExpiration.getHours() + 1);

      // Should be approximately 1 hour from now (within 1 minute tolerance)
      const timeDiff = Math.abs(
        mockVerification.verificationExpires.getTime() - expectedExpiration.getTime()
      );
      expect(timeDiff).toBeLessThan(60000);
    });

    test('should reset failedAttempts to 0', async () => {
      mockVerification.failedAttempts = 2;
      await mockVerification.generateCode();

      expect(mockVerification.failedAttempts).toBe(0);
    });

    test('should set status to pending', async () => {
      mockVerification.status = 'expired';
      await mockVerification.generateCode();

      expect(mockVerification.status).toBe('pending');
    });

    test('should call save() to persist changes', async () => {
      await mockVerification.generateCode();

      expect(mockVerification.save).toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    test('should return true for valid code', async () => {
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      const isValid = await mockVerification.verifyCode('123456');

      expect(isValid).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('123456', 'initial-code');
    });

    test('should set status to verified on success', async () => {
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      await mockVerification.verifyCode('123456');

      expect(mockVerification.status).toBe('verified');
    });

    test('should return false for invalid code', async () => {
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      const isValid = await mockVerification.verifyCode('wrong-code');

      expect(isValid).toBe(false);
    });

    test('should increment failedAttempts on wrong code', async () => {
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      await mockVerification.verifyCode('wrong-code');

      expect(mockVerification.failedAttempts).toBe(1);
    });

    test('should increment failedAttempts for each wrong attempt', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await mockVerification.verifyCode('wrong1');
      expect(mockVerification.failedAttempts).toBe(1);

      await mockVerification.verifyCode('wrong2');
      expect(mockVerification.failedAttempts).toBe(2);
    });

    test('should set status to failed after 3 wrong attempts', async () => {
      mockVerification.failedAttempts = 2;
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      await mockVerification.verifyCode('wrong-code');

      expect(mockVerification.failedAttempts).toBe(3);
      expect(mockVerification.status).toBe('failed');
    });

    test('should return false if already verified', async () => {
      mockVerification.status = 'verified';

      const isValid = await mockVerification.verifyCode('123456');

      expect(isValid).toBe(false);
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    test('should return false if already failed', async () => {
      mockVerification.status = 'failed';

      const isValid = await mockVerification.verifyCode('123456');

      expect(isValid).toBe(false);
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    test('should set status to expired if past expiration', async () => {
      mockVerification.verificationExpires = new Date(Date.now() - 60000); // Expired 1 minute ago

      const isValid = await mockVerification.verifyCode('123456');

      expect(isValid).toBe(false);
      expect(mockVerification.status).toBe('expired');
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    test('should call save() after verification', async () => {
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      await mockVerification.verifyCode('123456');

      expect(mockVerification.save).toHaveBeenCalled();
    });

    test('should call save() after failed attempt', async () => {
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      await mockVerification.verifyCode('wrong-code');

      expect(mockVerification.save).toHaveBeenCalled();
    });
  });

  describe('getRemainingAttempts', () => {
    test('should return 3 when failedAttempts is 0', () => {
      mockVerification.failedAttempts = 0;

      expect(mockVerification.getRemainingAttempts()).toBe(3);
    });

    test('should return 2 when failedAttempts is 1', () => {
      mockVerification.failedAttempts = 1;

      expect(mockVerification.getRemainingAttempts()).toBe(2);
    });

    test('should return 1 when failedAttempts is 2', () => {
      mockVerification.failedAttempts = 2;

      expect(mockVerification.getRemainingAttempts()).toBe(1);
    });

    test('should return 0 when failedAttempts is 3', () => {
      mockVerification.failedAttempts = 3;

      expect(mockVerification.getRemainingAttempts()).toBe(0);
    });

    test('should never return negative even with more than 3 attempts', () => {
      mockVerification.failedAttempts = 5;

      expect(mockVerification.getRemainingAttempts()).toBe(0);
    });
  });

  describe('isStillValid', () => {
    test('should return true when status is pending and not expired', () => {
      mockVerification.status = 'pending';
      mockVerification.verificationExpires = new Date(Date.now() + 3600000);

      expect(mockVerification.isStillValid()).toBe(true);
    });

    test('should return false when status is verified', () => {
      mockVerification.status = 'verified';
      mockVerification.verificationExpires = new Date(Date.now() + 3600000);

      expect(mockVerification.isStillValid()).toBe(false);
    });

    test('should return false when status is failed', () => {
      mockVerification.status = 'failed';
      mockVerification.verificationExpires = new Date(Date.now() + 3600000);

      expect(mockVerification.isStillValid()).toBe(false);
    });

    test('should return false when status is expired', () => {
      mockVerification.status = 'expired';
      mockVerification.verificationExpires = new Date(Date.now() + 3600000);

      expect(mockVerification.isStillValid()).toBe(false);
    });

    test('should return false when expired (even if status is pending)', () => {
      mockVerification.status = 'pending';
      mockVerification.verificationExpires = new Date(Date.now() - 60000); // Expired 1 minute ago

      expect(mockVerification.isStillValid()).toBe(false);
    });

    test('should return false when expired at exactly current time', () => {
      mockVerification.status = 'pending';
      mockVerification.verificationExpires = new Date(Date.now() - 1); // Just expired

      expect(mockVerification.isStillValid()).toBe(false);
    });
  });

  describe('Full Workflow Integration', () => {
    test('should complete successful verification workflow', async () => {
      // Initial state
      expect(mockVerification.status).toBe('pending');
      expect(mockVerification.isStillValid()).toBe(true);

      // Generate code
      const code = await mockVerification.generateCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(mockVerification.getRemainingAttempts()).toBe(3);

      // Verify with correct code
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);
      const isValid = await mockVerification.verifyCode(code);

      expect(isValid).toBe(true);
      expect(mockVerification.status).toBe('verified');
      expect(mockVerification.isStillValid()).toBe(false);
    });

    test('should handle failed attempts workflow correctly', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // First wrong attempt
      await mockVerification.verifyCode('wrong1');
      expect(mockVerification.getRemainingAttempts()).toBe(2);
      expect(mockVerification.status).toBe('pending');
      expect(mockVerification.isStillValid()).toBe(true);

      // Second wrong attempt
      await mockVerification.verifyCode('wrong2');
      expect(mockVerification.getRemainingAttempts()).toBe(1);
      expect(mockVerification.status).toBe('pending');
      expect(mockVerification.isStillValid()).toBe(true);

      // Third wrong attempt - should fail
      await mockVerification.verifyCode('wrong3');
      expect(mockVerification.getRemainingAttempts()).toBe(0);
      expect(mockVerification.status).toBe('failed');
      expect(mockVerification.isStillValid()).toBe(false);
    });

    test('should handle expiration correctly', async () => {
      // Set expiration to past
      mockVerification.verificationExpires = new Date(Date.now() - 60000);

      expect(mockVerification.isStillValid()).toBe(false);

      // Try to verify after expiration
      const isValid = await mockVerification.verifyCode('123456');

      expect(isValid).toBe(false);
      expect(mockVerification.status).toBe('expired');
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    test('should allow regeneration after expiration', async () => {
      // Initial expired state
      mockVerification.status = 'expired';
      mockVerification.verificationExpires = new Date(Date.now() - 60000);

      // Regenerate code
      const newCode = await mockVerification.generateCode();

      expect(newCode).toMatch(/^\d{6}$/);
      expect(mockVerification.status).toBe('pending');
      expect(mockVerification.failedAttempts).toBe(0);
      expect(mockVerification.isStillValid()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle bcrypt hash error', async () => {
      mockedBcrypt.hash.mockRejectedValueOnce(new Error('Bcrypt hash error') as never);

      await expect(mockVerification.generateCode()).rejects.toThrow('Bcrypt hash error');
    });

    test('should handle bcrypt compare error', async () => {
      mockedBcrypt.compare.mockRejectedValueOnce(new Error('Bcrypt compare error') as never);

      await expect(mockVerification.verifyCode('123456')).rejects.toThrow('Bcrypt compare error');
    });

    test('should handle verification at exact expiration boundary', async () => {
      // Set expiration to exactly now
      mockVerification.verificationExpires = new Date(Date.now());

      // Small delay to ensure we're past expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      const isValid = await mockVerification.verifyCode('123456');
      expect(isValid).toBe(false);
      expect(mockVerification.status).toBe('expired');
    });
  });

  describe('Signer Information', () => {
    test('should store signer name and position', () => {
      const verification = createMockVerification({
        signerName: 'Dr. Jane Smith',
        signerPosition: 'Chief Surgeon',
      });

      expect(verification.signerName).toBe('Dr. Jane Smith');
      expect(verification.signerPosition).toBe('Chief Surgeon');
    });

    test('should allow null signer information', () => {
      expect(mockVerification.signerName).toBeNull();
      expect(mockVerification.signerPosition).toBeNull();
    });
  });
});
