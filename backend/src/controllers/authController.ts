import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import logger from '../utils/logger';
import priorityService from '../services/priorityService';

// JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT token
const generateToken = (id: string) => {
  return jwt.sign({ id }, JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Request verification code
// @route   POST /api/auth/request-code
// @access  Public
export const requestVerificationCode = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.body;

  if (!identifier) {
    res.status(400);
    throw new Error('Email or phone number is required');
  }

  // Check if the identifier is an email or phone number
  const isEmail = identifier.includes('@');

  try {
    // For testing/development only allow test@example.com
    if (identifier === 'test@example.com') {
      logger.info(`Using test account flow for ${identifier}`);

      // Find or create test user
      let user = await User.findOne({ where: { email: identifier } });

      if (!user) {
        user = await User.create({
          name: 'Test User',
          email: identifier,
          phoneNumber: null,
          role: 'admin',
          metadata: {
            positionCode: '99',
            custName: '100078',
            sites: ['100078'],
          },
        });
        logger.info(`Created test user: ${user.id}`);
      }

      // Generate verification code
      const verificationCode = await user.generateVerificationCode();
      logger.info(`Verification code for ${identifier}: ${verificationCode}`);

      res.status(200).json({
        success: true,
        message: 'Verification code sent',
        userData: {
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber || '',
          positionCode: user.metadata?.positionCode || '99',
          custName: user.metadata?.custName || '100078',
        },
      });
      return;
    }

    // First, validate against Priority system
    logger.info(`Validating ${isEmail ? 'email' : 'phone'}: ${identifier} with Priority`);
    const priorityUserAccess = await priorityService.getUserSiteAccess(identifier);

    if (!priorityUserAccess.found) {
      logger.info(`${isEmail ? 'Email' : 'Phone'} ${identifier} not found in Priority system`);
      res.status(404).json({
        success: false,
        message: `${isEmail ? 'Email' : 'Phone'} not found in the system`,
      });
      return;
    }

    // Priority validation successful, find or create local user
    logger.info(`${isEmail ? 'Email' : 'Phone'} ${identifier} found in Priority system`);

    // Find local user
    let user;
    if (isEmail) {
      user = await User.findOne({ where: { email: identifier } });
    } else {
      user = await User.findOne({ where: { phoneNumber: identifier } });
    }

    // If not found locally, create user from Priority data
    if (!user) {
      const userData = {
        name: priorityUserAccess.user?.email || 'User',
        email: isEmail ? identifier : null,
        phoneNumber: isEmail ? priorityUserAccess.user?.phone : identifier,
        role:
          priorityUserAccess.user?.positionCode === 99
            ? 'admin'
            : ('hospital' as 'admin' | 'hospital'),
        metadata: {
          positionCode: priorityUserAccess.user?.positionCode,
          custName: priorityUserAccess.sites[0] || '',
          sites: priorityUserAccess.sites || [],
        },
      } as const; // Fix: ensure type is compatible

      user = await User.create(userData);
      logger.info(`Created new user from Priority data: ${user.id}`);
    } else {
      // Update user metadata with latest from Priority
      user.metadata = {
        ...user.metadata,
        positionCode: priorityUserAccess.user?.positionCode,
        custName: priorityUserAccess.sites[0] || '',
        sites: priorityUserAccess.sites || [],
      };
      await user.save();
      logger.info(`Updated existing user with Priority data: ${user.id}`);
    }

    // Generate verification code
    const verificationCode = await user.generateVerificationCode();

    // In a real app, send the code via SMS or email
    // For demo purposes, we'll just log it
    logger.info(`Verification code for ${identifier}: ${verificationCode}`);

    res.status(200).json({
      success: true,
      message: 'Verification code sent',
      userData: {
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        positionCode: user.metadata?.positionCode || '',
        custName: user.metadata?.custName || '',
        sites: user.metadata?.sites || [],
      },
    });
  } catch (error: any) {
    logger.error(`Error requesting verification code: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
    });
  }
});

// @desc    Verify code and login
// @route   POST /api/auth/verify
// @access  Public
export const verifyCode = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, code } = req.body;

  if (!identifier || !code) {
    res.status(400);
    throw new Error('Email/phone and verification code are required');
  }

  // Check if the identifier is an email or phone number
  const isEmail = identifier.includes('@');

  // Find the user by email or phone number
  let user;
  if (isEmail) {
    user = await User.findOne({ where: { email: identifier } });
  } else {
    user = await User.findOne({ where: { phoneNumber: identifier } });
  }

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Verify the code
  const isValid = await user.verifyCode(code);

  if (!isValid) {
    // Check if failed attempts exceed limit
    if (user.failedAttempts >= 3) {
      // In a real app, notify admin
      logger.warn(`User ${identifier} exceeded verification attempts limit`);
    }

    res.status(401);
    throw new Error('Invalid verification code');
  }

  // Generate JWT token
  const token = generateToken(user.id);

  res.status(200).json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      role: user.role,
      positionCode: user.metadata?.positionCode?.toString() || '',
      custName: user.metadata?.custName || '',
      sites: user.metadata?.sites || [],
      fullAccess: user.metadata?.positionCode === 99
    },
    token,
  });
});

// @desc    Resend verification code
// @route   POST /api/auth/resend-code
// @access  Public
export const resendVerificationCode = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.body;

  if (!identifier) {
    res.status(400);
    throw new Error('Email or phone number is required');
  }

  try {
    // Check if the identifier is an email or phone number
    const isEmail = identifier.includes('@');

    // Find the user by email or phone number
    let user;
    if (isEmail) {
      user = await User.findOne({ where: { email: identifier } });
    } else {
      user = await User.findOne({ where: { phoneNumber: identifier } });
    }

    if (!user) {
      // If user not found in local DB, check against Priority first
      const priorityUserAccess = await priorityService.getUserSiteAccess(identifier);

      if (!priorityUserAccess.found) {
        res.status(404);
        throw new Error('User not found in the system');
      }

      // If found in Priority but not locally, create a new user
      const userData = {
        name: priorityUserAccess.user?.email || 'User',
        email: isEmail ? identifier : null,
        phoneNumber: isEmail ? priorityUserAccess.user?.phone : identifier,
        role:
          priorityUserAccess.user?.positionCode === 99
            ? 'admin'
            : ('hospital' as 'admin' | 'hospital'),
        metadata: {
          positionCode: priorityUserAccess.user?.positionCode,
          custName: priorityUserAccess.sites[0] || '',
          sites: priorityUserAccess.sites || [],
        },
      } as const; // Fix: ensure type is compatible

      user = await User.create(userData);
      logger.info(`Created new user from Priority data on resend: ${user.id}`);
    }

    // Generate verification code
    const verificationCode = await user.generateVerificationCode();

    // In a real app, send the code via SMS or email
    // For demo purposes, we'll just log it
    logger.info(`Resent verification code for ${identifier}: ${verificationCode}`);

    res.status(200).json({
      success: true,
      message: 'Verification code resent',
    });
  } catch (error: any) {
    logger.error(`Error resending verification code: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`,
    });
  }
});

// @desc    Validate token
// @route   POST /api/auth/validate-token
// @access  Private
export const validateToken = asyncHandler(async (req: Request, res: Response) => {
  // If the request made it past the protect middleware, the token is valid
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      phoneNumber: req.user.phoneNumber,
      role: req.user.role,
      metadata: req.user.metadata,
    },
  });
});
