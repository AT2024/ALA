import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Middleware to log detailed request and response information for debugging
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = `req_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object for correlation
  req.requestId = requestId;
  
  // Log the incoming request
  logger.info(`[REQUEST_LOG] Incoming request`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    params: req.params,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'authorization': req.headers.authorization ? '[PRESENT]' : '[NOT_PRESENT]'
    },
    user: req.user ? {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    } : null,
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress
  });

  // Store original json and status methods
  const originalJson = res.json;
  const originalStatus = res.status;
  let responseBody: any;
  let statusCode: number;

  // Override res.json to capture response data
  res.json = function(data: any) {
    responseBody = data;
    return originalJson.call(this, data);
  };

  // Override res.status to capture status code
  res.status = function(code: number) {
    statusCode = code;
    return originalStatus.call(this, code);
  };

  // Log response when request finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const finalStatusCode = statusCode || res.statusCode;
    
    logger.info(`[RESPONSE_LOG] Request completed`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: finalStatusCode,
      duration: `${duration}ms`,
      success: finalStatusCode < 400,
      responseSize: res.get('content-length') || 'unknown',
      responseBody: finalStatusCode >= 400 ? responseBody : undefined, // Only log body for errors
      timestamp: new Date().toISOString()
    });

    // Log warning for slow requests
    if (duration > 5000) {
      logger.warn(`[PERFORMANCE_WARNING] Slow request detected`, {
        requestId,
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        threshold: '5000ms'
      });
    }
  });

  // Log response when request encounters an error
  res.on('error', (error) => {
    const duration = Date.now() - startTime;
    
    logger.error(`[REQUEST_ERROR] Request failed`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      duration: `${duration}ms`,
      error: {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      timestamp: new Date().toISOString()
    });
  });

  next();
};

/**
 * Middleware specifically for treatment operations with enhanced logging
 */
export const treatmentRequestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = `treatment_${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  
  // Enhanced logging for treatment operations
  logger.info(`[TREATMENT_REQUEST] Treatment operation started`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    treatmentId: req.params.id || req.params.treatmentId,
    applicatorId: req.params.applicatorId,
    params: req.params,
    query: req.query,
    body: req.method !== 'GET' ? {
      ...req.body,
      // Mask sensitive data if any
      verificationCode: req.body?.verificationCode ? '[MASKED]' : undefined
    } : undefined,
    user: req.user ? {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email,
      sites: req.user.metadata?.sites || []
    } : null,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });

  // Store original methods for response logging
  const originalJson = res.json;
  let responseData: any;

  res.json = function(data: any) {
    responseData = data;
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    logger.info(`[TREATMENT_RESPONSE] Treatment operation completed`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      treatmentId: req.params.id || req.params.treatmentId,
      statusCode,
      duration: `${duration}ms`,
      success: statusCode < 400,
      responseData: statusCode >= 400 || process.env.NODE_ENV === 'development' ? responseData : {
        // For successful responses, only log summary data
        id: responseData?.id,
        type: responseData?.type,
        success: responseData?.success,
        message: responseData?.message,
        recordCount: Array.isArray(responseData) ? responseData.length : undefined
      },
      timestamp: new Date().toISOString()
    });

    // Performance monitoring for treatment operations
    if (duration > 3000) {
      logger.warn(`[TREATMENT_PERFORMANCE] Slow treatment operation`, {
        requestId,
        method: req.method,
        url: req.originalUrl,
        treatmentId: req.params.id || req.params.treatmentId,
        duration: `${duration}ms`,
        threshold: '3000ms',
        recommendation: 'Consider optimizing database queries or caching'
      });
    }
  });

  next();
};

// Extend Express Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}