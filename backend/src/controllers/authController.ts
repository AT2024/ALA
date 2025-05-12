import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import logger from '../utils/logger';

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
    message: 'Verification code sent',
  });
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
    },
  });
});
