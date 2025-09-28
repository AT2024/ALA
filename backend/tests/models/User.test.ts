// User Model Test Suite - Medical Application Testing
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Sequelize, DataTypes } from 'sequelize';
import bcrypt from 'bcryptjs';
import User from '../../src/models/User';
import { testSequelize } from '../setup';

// Mock bcrypt
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('User Model', () => {
  let sequelize: Sequelize;

  beforeEach(async () => {
    // Use in-memory SQLite for testing
    sequelize = new Sequelize('sqlite::memory:', {
      logging: false,
    });

    // Re-initialize User model with test database
    User.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
          validate: {
            isEmail: true,
          },
        },
        phoneNumber: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        role: {
          type: DataTypes.ENUM('hospital', 'alphatau', 'admin'),
          allowNull: false,
          defaultValue: 'hospital',
        },
        verificationCode: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        verificationExpires: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        failedAttempts: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        lastLogin: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: {},
        },
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        timestamps: true,
      }
    );

    await sequelize.sync({ force: true });

    // Reset bcrypt mocks
    mockedBcrypt.hash.mockResolvedValue('hashed-code' as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
  });

  afterEach(async () => {
    await sequelize.close();
    jest.clearAllMocks();
  });

  describe('Model Structure', () => {
    test('should create User table with correct fields', async () => {
      const tableInfo = await sequelize.getQueryInterface().describeTable('users');

      expect(tableInfo).toHaveProperty('id');
      expect(tableInfo).toHaveProperty('name');
      expect(tableInfo).toHaveProperty('email');
      expect(tableInfo).toHaveProperty('phoneNumber');
      expect(tableInfo).toHaveProperty('role');
      expect(tableInfo).toHaveProperty('verificationCode');
      expect(tableInfo).toHaveProperty('verificationExpires');
      expect(tableInfo).toHaveProperty('failedAttempts');
      expect(tableInfo).toHaveProperty('lastLogin');
      expect(tableInfo).toHaveProperty('metadata');
      expect(tableInfo).toHaveProperty('createdAt');
      expect(tableInfo).toHaveProperty('updatedAt');
    });

    test('should have correct default values', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com'
      });

      expect(user.role).toBe('hospital');
      expect(user.failedAttempts).toBe(0);
      expect(user.metadata).toEqual({});
      expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test('should validate email format', async () => {
      await expect(
        User.create({
          name: 'Test User',
          email: 'invalid-email'
        })
      ).rejects.toThrow();
    });

    test('should enforce unique email constraint', async () => {
      await User.create({
        name: 'Test User 1',
        email: 'test@example.com'
      });

      await expect(
        User.create({
          name: 'Test User 2',
          email: 'test@example.com'
        })
      ).rejects.toThrow();
    });

    test('should enforce unique phone number constraint', async () => {
      await User.create({
        name: 'Test User 1',
        phoneNumber: '555-123-4567'
      });

      await expect(
        User.create({
          name: 'Test User 2',
          phoneNumber: '555-123-4567'
        })
      ).rejects.toThrow();
    });

    test('should validate role enum', async () => {
      await expect(
        User.create({
          name: 'Test User',
          email: 'test@example.com',
          role: 'invalid-role' as any
        })
      ).rejects.toThrow();
    });

    test('should allow null email and phoneNumber', async () => {
      const user = await User.create({
        name: 'Test User',
        email: null,
        phoneNumber: null
      });

      expect(user.email).toBeNull();
      expect(user.phoneNumber).toBeNull();
    });
  });

  describe('generateVerificationCode', () => {
    test('should generate fixed verification code', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com'
      });

      const code = await user.generateVerificationCode();

      expect(code).toBe('123456');
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('123456', 10);
      expect(user.verificationCode).toBe('hashed-code');
      expect(user.verificationExpires).toBeInstanceOf(Date);
    });

    test('should set expiration time 10 minutes in future', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com'
      });

      const beforeGeneration = new Date();
      await user.generateVerificationCode();
      const afterGeneration = new Date();

      const expectedExpiration = new Date();
      expectedExpiration.setMinutes(expectedExpiration.getMinutes() + 10);

      expect(user.verificationExpires).toBeInstanceOf(Date);
      // Should be approximately 10 minutes from now (within 1 minute tolerance)
      const timeDiff = Math.abs(user.verificationExpires!.getTime() - expectedExpiration.getTime());
      expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
    });

    test('should update verification code in database', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com'
      });

      await user.generateVerificationCode();

      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser!.verificationCode).toBe('hashed-code');
      expect(updatedUser!.verificationExpires).toBeInstanceOf(Date);
    });
  });

  describe('verifyCode', () => {
    test('should verify correct code successfully', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com'
      });

      await user.generateVerificationCode();
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      const isValid = await user.verifyCode('123456');

      expect(isValid).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('123456', 'hashed-code');
      expect(user.verificationCode).toBeNull();
      expect(user.verificationExpires).toBeNull();
      expect(user.failedAttempts).toBe(0);
      expect(user.lastLogin).toBeInstanceOf(Date);
    });

    test('should reject incorrect code', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com'
      });

      await user.generateVerificationCode();
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      const isValid = await user.verifyCode('wrong-code');

      expect(isValid).toBe(false);
      expect(user.failedAttempts).toBe(1);
      expect(user.verificationCode).toBe('hashed-code'); // Should not be cleared
    });

    test('should reject when no verification code exists', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        verificationCode: null
      });

      const isValid = await user.verifyCode('123456');

      expect(isValid).toBe(false);
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    test('should reject expired verification code', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        verificationCode: 'hashed-code',
        verificationExpires: new Date(Date.now() - 60000) // 1 minute ago
      });

      const isValid = await user.verifyCode('123456');

      expect(isValid).toBe(false);
      expect(user.verificationCode).toBeNull();
      expect(user.verificationExpires).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    test('should increment failed attempts for wrong code', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        failedAttempts: 1
      });

      await user.generateVerificationCode();
      mockedBcrypt.compare.mockResolvedValueOnce(false as never);

      const isValid = await user.verifyCode('wrong-code');

      expect(isValid).toBe(false);
      expect(user.failedAttempts).toBe(2);
    });

    test('should clear failed attempts on successful verification', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        failedAttempts: 2
      });

      await user.generateVerificationCode();
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      const isValid = await user.verifyCode('123456');

      expect(isValid).toBe(true);
      expect(user.failedAttempts).toBe(0);
    });

    test('should update lastLogin on successful verification', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        lastLogin: null
      });

      await user.generateVerificationCode();
      mockedBcrypt.compare.mockResolvedValueOnce(true as never);

      const beforeLogin = new Date();
      await user.verifyCode('123456');
      const afterLogin = new Date();

      expect(user.lastLogin).toBeInstanceOf(Date);
      expect(user.lastLogin!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
      expect(user.lastLogin!.getTime()).toBeLessThanOrEqual(afterLogin.getTime());
    });
  });

  describe('User Creation Scenarios', () => {
    test('should create hospital user with basic information', async () => {
      const user = await User.create({
        name: 'Hospital User',
        email: 'hospital@example.com',
        role: 'hospital',
        metadata: {
          positionCode: 1,
          custName: '100078',
          sites: [{ custName: '100078', custDes: 'Main Test Hospital' }],
          fullAccess: false
        }
      });

      expect(user.name).toBe('Hospital User');
      expect(user.role).toBe('hospital');
      expect(user.metadata.positionCode).toBe(1);
      expect(user.metadata.fullAccess).toBe(false);
    });

    test('should create admin user with full access', async () => {
      const user = await User.create({
        name: 'Admin User',
        email: 'admin@alphatau.com',
        role: 'admin',
        metadata: {
          positionCode: 99,
          custName: 'ALL_SITES',
          sites: [
            { custName: '100078', custDes: 'Main Test Hospital' },
            { custName: '100040', custDes: 'Test Hospital' }
          ],
          fullAccess: true
        }
      });

      expect(user.role).toBe('admin');
      expect(user.metadata.positionCode).toBe(99);
      expect(user.metadata.fullAccess).toBe(true);
      expect(user.metadata.sites).toHaveLength(2);
    });

    test('should create user with phone number only', async () => {
      const user = await User.create({
        name: 'Phone User',
        phoneNumber: '555-123-4567',
        email: null
      });

      expect(user.phoneNumber).toBe('555-123-4567');
      expect(user.email).toBeNull();
    });

    test('should handle complex metadata', async () => {
      const complexMetadata = {
        positionCode: 1,
        custName: '100078',
        sites: [
          { custName: '100078', custDes: 'Main Test Hospital' }
        ],
        fullAccess: false,
        lastPrioritySync: new Date(),
        preferences: {
          language: 'en',
          timezone: 'UTC',
          notifications: true
        }
      };

      const user = await User.create({
        name: 'Complex User',
        email: 'complex@example.com',
        metadata: complexMetadata
      });

      expect(user.metadata).toEqual(complexMetadata);
    });
  });

  describe('Database Persistence', () => {
    test('should persist user data correctly', async () => {
      const userData = {
        name: 'Persistent User',
        email: 'persistent@example.com',
        role: 'admin' as const,
        metadata: {
          positionCode: 99,
          fullAccess: true
        }
      };

      const user = await User.create(userData);
      const userId = user.id;

      // Clear any caching by querying fresh
      const retrievedUser = await User.findByPk(userId);

      expect(retrievedUser).not.toBeNull();
      expect(retrievedUser!.name).toBe(userData.name);
      expect(retrievedUser!.email).toBe(userData.email);
      expect(retrievedUser!.role).toBe(userData.role);
      expect(retrievedUser!.metadata).toEqual(userData.metadata);
    });

    test('should handle user updates', async () => {
      const user = await User.create({
        name: 'Original Name',
        email: 'original@example.com',
        failedAttempts: 0
      });

      user.name = 'Updated Name';
      user.failedAttempts = 3;
      await user.save();

      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser!.name).toBe('Updated Name');
      expect(updatedUser!.failedAttempts).toBe(3);
    });

    test('should handle metadata updates', async () => {
      const user = await User.create({
        name: 'Metadata User',
        email: 'metadata@example.com',
        metadata: { original: 'data' }
      });

      user.metadata = { updated: 'data', new: 'field' };
      await user.save();

      const updatedUser = await User.findByPk(user.id);
      expect(updatedUser!.metadata).toEqual({ updated: 'data', new: 'field' });
    });
  });

  describe('Timestamps', () => {
    test('should set createdAt and updatedAt on creation', async () => {
      const beforeCreate = new Date();
      const user = await User.create({
        name: 'Timestamp User',
        email: 'timestamp@example.com'
      });
      const afterCreate = new Date();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    test('should update updatedAt on save', async () => {
      const user = await User.create({
        name: 'Update User',
        email: 'update@example.com'
      });

      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      user.name = 'Updated Name';
      await user.save();

      expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe('Error Handling', () => {
    test('should handle bcrypt errors gracefully', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com'
      });

      mockedBcrypt.hash.mockRejectedValueOnce(new Error('Bcrypt error'));

      await expect(user.generateVerificationCode()).rejects.toThrow('Bcrypt error');
    });

    test('should handle bcrypt compare errors gracefully', async () => {
      const user = await User.create({
        name: 'Test User',
        email: 'test@example.com',
        verificationCode: 'hashed-code',
        verificationExpires: new Date(Date.now() + 600000) // 10 minutes in future
      });

      mockedBcrypt.compare.mockRejectedValueOnce(new Error('Compare error'));

      await expect(user.verifyCode('123456')).rejects.toThrow('Compare error');
    });

    test('should handle database constraint violations', async () => {
      await User.create({
        name: 'First User',
        email: 'duplicate@example.com'
      });

      await expect(
        User.create({
          name: 'Second User',
          email: 'duplicate@example.com'
        })
      ).rejects.toThrow();
    });
  });
});