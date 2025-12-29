import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// UUID validation regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware to validate UUID parameters in routes
 * @param paramName - The name of the parameter to validate (e.g., 'id', 'treatmentId')
 */
export const validateUUID = (paramName = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const paramValue = req.params[paramName];
    
    logger.debug(`[UUID_VALIDATION] Validating parameter: ${paramName}`, {
      paramValue,
      paramType: typeof paramValue,
      paramLength: paramValue?.length,
      requestUrl: req.originalUrl,
      requestMethod: req.method
    });

    if (!paramValue) {
      logger.error(`[UUID_VALIDATION] Missing required parameter: ${paramName}`, {
        requestUrl: req.originalUrl,
        requestMethod: req.method,
        allParams: req.params
      });
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: `Missing required parameter: ${paramName}`,
        details: {
          parameter: paramName,
          received: paramValue,
          expected: 'Valid UUID string'
        }
      });
    }

    if (typeof paramValue !== 'string') {
      logger.error(`[UUID_VALIDATION] Parameter ${paramName} is not a string`, {
        paramValue,
        paramType: typeof paramValue,
        requestUrl: req.originalUrl
      });
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: `Parameter ${paramName} must be a string`,
        details: {
          parameter: paramName,
          received: typeof paramValue,
          expected: 'string'
        }
      });
    }

    if (!UUID_REGEX.test(paramValue)) {
      logger.error(`[UUID_VALIDATION] Invalid UUID format for parameter: ${paramName}`, {
        paramValue,
        paramLength: paramValue.length,
        requestUrl: req.originalUrl,
        requestMethod: req.method
      });
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: `Invalid UUID format for parameter: ${paramName}`,
        details: {
          parameter: paramName,
          received: paramValue,
          expected: 'Valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)',
          pattern: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        }
      });
    }

    logger.debug(`[UUID_VALIDATION] Parameter ${paramName} validation passed`, {
      paramValue,
      requestUrl: req.originalUrl
    });

    next();
  };
};

/**
 * Middleware to validate multiple UUID parameters
 * @param paramNames - Array of parameter names to validate
 */
export const validateMultipleUUIDs = (paramNames: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const paramName of paramNames) {
      const paramValue = req.params[paramName];
      
      if (paramValue && !UUID_REGEX.test(paramValue)) {
        logger.error(`[UUID_VALIDATION] Invalid UUID format for parameter: ${paramName}`, {
          paramValue,
          requestUrl: req.originalUrl,
          allParams: req.params
        });
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: `Invalid UUID format for parameter: ${paramName}`,
          details: {
            parameter: paramName,
            received: paramValue,
            expected: 'Valid UUID format'
          }
        });
      }
    }
    
    logger.debug(`[UUID_VALIDATION] All UUID parameters validation passed`, {
      validatedParams: paramNames,
      requestUrl: req.originalUrl
    });
    
    next();
  };
};

/**
 * Utility function to validate UUID strings programmatically
 * @param value - The value to validate
 * @returns boolean indicating if the value is a valid UUID
 */
export const isValidUUID = (value: any): boolean => {
  if (typeof value !== 'string') {
    return false;
  }
  return UUID_REGEX.test(value);
};

/**
 * Utility function to validate and normalize UUID
 * @param value - The UUID value to validate and normalize
 * @returns normalized UUID string or null if invalid
 */
export const validateAndNormalizeUUID = (value: any): string | null => {
  if (!isValidUUID(value)) {
    return null;
  }
  return value.toLowerCase();
};