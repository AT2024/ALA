import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import logger from '../utils/logger';
import priorityService from '../services/priorityService';
import { Op } from 'sequelize';

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

  // First, check Priority system for the user
  try {
    let priorityUser;
    try {
      priorityUser = await priorityService.getUserSiteAccess(identifier);
    } catch (priorityError) {
      // Log the error but continue with local authentication
      logger.warn(`Priority system error: ${priorityError}. Continuing with local authentication.`);
      
      // Create a default priorityUser object to continue the flow
      priorityUser = {
        found: true,
        fullAccess: false,
        sites: [],
        user: {
          email: identifier.includes('@') ? identifier : null,
          phone: !identifier.includes('@') ? identifier : null,
          positionCode: 0
        }
      };
    }
    
    if (!priorityUser.found) {
      res.status(404);
      throw new Error('User not found in Priority system');
    }
    
    // Make sure priorityUser.user exists before using it
    if (!priorityUser.user) {
      res.status(500);
      throw new Error('Invalid user data from Priority system');
    }
    
    // Check if the user exists in our database - use multiple ways to lookup
    const isEmail = identifier.includes('@');
    let user;
    
    // Try finding by the provided identifier first
    if (isEmail) {
      user = await User.findOne({ where: { email: identifier } });
    } else {
      user = await User.findOne({ where: { phoneNumber: identifier } });
    }
    
    // Use optional chaining and nullish coalescing for safe property access
    const userName = priorityUser.user?.email || priorityUser.user?.phone || 'Unknown Name';
    const userEmail = priorityUser.user?.email || null;
    const userPhone = priorityUser.user?.phone || identifier; // Use provided identifier if no phone found
    const userPositionCode = priorityUser.user?.positionCode;
    
    try {
      // If not found by identifier but we have email from Priority, try finding by that email
      if (!user && userEmail) {
        user = await User.findOne({ where: { email: userEmail } });
      }
      
      // If still no user, create a new one
      if (!user) {
        // Create new user, but ensure we're not making duplicates
        const [newUser, created] = await User.findOrCreate({
          where: {
            [Op.or]: [
              { email: userEmail },
              { phoneNumber: userPhone }
            ]
          },
          defaults: {
            name: userName,
            email: userEmail,
            phoneNumber: userPhone,
            role: priorityUser.fullAccess ? 'alphatau' : 'hospital',
            metadata: { 
              sites: priorityUser.sites,
              positionCode: userPositionCode
            }
          }
        });
        
        user = newUser;
        
        if (!created) {
          // If the user existed but was found via findOrCreate, update their data
          user.metadata = { 
            sites: priorityUser.sites,
            positionCode: userPositionCode
          };
          
          // Update email or phone if they were null before
          if (userEmail && !user.email) user.email = userEmail;
          if (userPhone && !user.phoneNumber) user.phoneNumber = userPhone;
          
          await user.save();
        }
      } else {
        // Update existing user with latest site permissions and data
        user.metadata = { 
          sites: priorityUser.sites,
          positionCode: userPositionCode
        };
        
        // Update email or phone if they were null before
        if (userEmail && !user.email) user.email = userEmail;
        if (userPhone && !user.phoneNumber) user.phoneNumber = userPhone;
        
        await user.save();
      }
    } catch (error: any) {
      // Special handling for database constraint errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        logger.warn(`Attempted to create duplicate user with identifier: ${identifier}`);
        
        // Try harder to find the existing user
        if (userEmail) {
          user = await User.findOne({ 
            where: { 
              [Op.or]: [
                { email: userEmail },
                { email: identifier }
              ]
            } 
          });
        } else if (userPhone) {
          user = await User.findOne({ 
            where: { 
              [Op.or]: [
                { phoneNumber: userPhone },
                { phoneNumber: identifier }
              ]
            } 
          });
        }
        
        if (!user) {
          logger.error('Could not find existing user after uniqueness error');
          throw new Error('Authentication error - please contact support');
        }
      } else {
        // For other errors, rethrow
        throw error;
      }
    }
    
    // Generate verification code
    const verificationCode = await user.generateVerificationCode();
    
    // In a real app, send the code via SMS or email
    // For demo purposes, we'll just log it
    logger.info(`Verification code for ${identifier}: ${verificationCode}`);
    
    res.status(200).json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    logger.error(`Error in requestVerificationCode: ${error}`);
    res.status(500);
    throw new Error('Failed to process authentication request');
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
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      metadata: user.metadata,
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

  // Generate verification code
  const verificationCode = await user.generateVerificationCode();

  // In a real app, send the code via SMS or email
  // For demo purposes, we'll just log it
  logger.info(`Verification code for ${identifier}: ${verificationCode}`);

  res.status(200).json({
    success: true,
    message: 'Verification code resent',
  });
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