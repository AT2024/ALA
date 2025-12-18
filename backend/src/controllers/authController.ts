import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import logger from '../utils/logger';
import priorityService from '../services/priorityService';
import { shouldEnforceHttps } from '../config/https';
import { sendVerificationCode } from '../services/emailService';

// Lazy getter for JWT secret with runtime validation
function getJwtSecret(): string {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return JWT_SECRET;
}

// Generate JWT token
const generateToken = (id: string) => {
  return jwt.sign({ id }, getJwtSecret(), {
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
    // First, validate against Priority system
    logger.info(`Validating ${isEmail ? 'email' : 'phone'}: ${identifier} with Priority`);
    
    let priorityUserAccess;
    try {
      priorityUserAccess = await priorityService.getUserSiteAccess(identifier);
    } catch (priorityError: any) {
      logger.error(`Priority system error for ${identifier}:`, priorityError);
      res.status(500).json({
        success: false,
        message: `Priority system error: ${priorityError.message}`,
      });
      return;
    }

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
      // Use Number() for positionCode comparisons to handle both string and number types
      const positionCode = Number(priorityUserAccess.user?.positionCode);
      const userData = {
        name: priorityUserAccess.user?.email || 'User',
        email: isEmail ? identifier : null,
        phoneNumber: isEmail ? priorityUserAccess.user?.phone : identifier,
        role:
          positionCode === 99
            ? 'admin'
            : ('hospital' as 'admin' | 'hospital'),
        metadata: {
          positionCode: priorityUserAccess.user?.positionCode,
          custName: positionCode === 99
            ? 'ALL_SITES'
            : (priorityUserAccess.sites[0]?.custName || priorityUserAccess.sites[0] || ''),
          sites: priorityUserAccess.sites || [],
          fullAccess: priorityUserAccess.fullAccess || false,
        },
      } as const; // Fix: ensure type is compatible

      user = await User.create(userData);
      logger.info(`Created new user from Priority data: ${user.id}`);
    } else {
      // Update user metadata with latest from Priority
      // Use Number() for positionCode comparisons to handle both string and number types
      const positionCode = Number(priorityUserAccess.user?.positionCode);
      user.metadata = {
        ...user.metadata,
        positionCode: priorityUserAccess.user?.positionCode,
        custName: positionCode === 99
          ? 'ALL_SITES'
          : (priorityUserAccess.sites[0]?.custName || priorityUserAccess.sites[0] || ''),
        sites: priorityUserAccess.sites || [],
        fullAccess: priorityUserAccess.fullAccess || false,
      };
      await user.save();
      logger.info(`Updated existing user with Priority data: ${user.id}`);
    }

    // Generate verification code
    const verificationCode = await user.generateVerificationCode();

    // Log the code (for development debugging)
    logger.info(`Verification code for ${identifier}: ${verificationCode}`);

    // Send verification code via email if it's an email identifier
    // For phone numbers, SMS would be needed (not implemented)
    if (isEmail) {
      try {
        await sendVerificationCode(identifier, verificationCode);
        logger.info(`Verification email sent to ${identifier}`);
      } catch (emailError: any) {
        // Log error but don't fail the request - user can still use the logged code
        // In production, the email service will send actual emails
        // In development, the code is just logged
        logger.warn(`Failed to send verification email: ${emailError.message}`);
      }
    }

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

  // Set secure cookie for HTTPS environments
  if (shouldEnforceHttps()) {
    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
  }

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
      fullAccess: Number(user.metadata?.positionCode) === 99
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
      // Use Number() for positionCode comparisons to handle both string and number types
      const positionCode = Number(priorityUserAccess.user?.positionCode);
      const userData = {
        name: priorityUserAccess.user?.email || 'User',
        email: isEmail ? identifier : null,
        phoneNumber: isEmail ? priorityUserAccess.user?.phone : identifier,
        role:
          positionCode === 99
            ? 'admin'
            : ('hospital' as 'admin' | 'hospital'),
        metadata: {
          positionCode: priorityUserAccess.user?.positionCode,
          custName: positionCode === 99
            ? 'ALL_SITES'
            : (priorityUserAccess.sites[0]?.custName || priorityUserAccess.sites[0] || ''),
          sites: priorityUserAccess.sites || [],
          fullAccess: priorityUserAccess.fullAccess || false,
        },
      } as const; // Fix: ensure type is compatible

      user = await User.create(userData);
      logger.info(`Created new user from Priority data on resend: ${user.id}`);
    }

    // Generate verification code
    const verificationCode = await user.generateVerificationCode();

    // Log the code (for development debugging)
    logger.info(`Resent verification code for ${identifier}: ${verificationCode}`);

    // Send verification code via email if it's an email identifier
    if (isEmail) {
      try {
        await sendVerificationCode(identifier, verificationCode);
        logger.info(`Resent verification email to ${identifier}`);
      } catch (emailError: any) {
        logger.warn(`Failed to resend verification email: ${emailError.message}`);
      }
    }

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

// @desc    Debug user site access
// @route   GET /api/auth/debug-sites/:identifier
// @access  Public (for testing)
export const debugUserSiteAccess = asyncHandler(async (req: Request, res: Response) => {
  const { identifier } = req.params;

  if (!identifier) {
    res.status(400).json({
      success: false,
      message: 'User identifier is required',
    });
    return;
  }

  try {
    logger.info(`[DEBUG] Testing site access for identifier: ${identifier}`);
    
    // First test basic Priority connection
    const connectionTest = await priorityService.debugPriorityConnection();
    
    if (!connectionTest.success) {
      res.status(500).json({
        success: false,
        message: 'Priority connection failed',
        connectionError: connectionTest.error,
        details: connectionTest.details,
      });
      return;
    }
    
    const priorityUserAccess = await priorityService.getUserSiteAccess(identifier);
    
    res.status(200).json({
      success: true,
      message: 'Debug site access check completed',
      connectionTest: {
        success: connectionTest.success,
        phonebookCount: connectionTest.phonebookCount,
      },
      data: {
        identifier: identifier,
        found: priorityUserAccess.found,
        fullAccess: priorityUserAccess.fullAccess,
        sites: priorityUserAccess.sites || [],
        siteCount: priorityUserAccess.sites ? priorityUserAccess.sites.length : 0,
        user: priorityUserAccess.user || null,
      },
    });
  } catch (error: any) {
    logger.error(`[DEBUG] Error testing site access: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Debug test failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
