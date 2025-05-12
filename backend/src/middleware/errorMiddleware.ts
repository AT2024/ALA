import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log error
  logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  
  // Handle specific error types
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: err.errors.map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Duplicate Entry',
      errors: err.errors.map((e: any) => ({
        field: e.path,
        message: e.message,
      })),
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  // Log stack trace in development
  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  }

  // Set status code
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  
  // Send response
  res.json({
    success: false,
    message: err.message || 'Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
