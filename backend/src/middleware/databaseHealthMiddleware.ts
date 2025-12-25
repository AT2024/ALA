import { Request, Response, NextFunction } from 'express';
import sequelize from '../config/database';
import { QueryTypes } from 'sequelize';
import logger from '../utils/logger';
import { config } from '../config/appConfig';

/**
 * Interface for database health check result
 */
interface DatabaseHealthResult {
  isHealthy: boolean;
  connectionTime?: number;
  error?: string;
  timestamp: string;
}

/**
 * Cache for database health check results to avoid excessive health checks
 */
class DatabaseHealthCache {
  private lastHealthCheck: DatabaseHealthResult | null = null;
  private cacheValidityMs: number = config.dbHealthCacheMs; // Configurable via DB_HEALTH_CACHE_MS env var

  public async getHealthStatus(): Promise<DatabaseHealthResult> {
    const now = Date.now();
    
    // Return cached result if it's still valid
    if (this.lastHealthCheck && 
        (now - new Date(this.lastHealthCheck.timestamp).getTime()) < this.cacheValidityMs) {
      logger.debug(`[DB_HEALTH] Using cached health status`, {
        isHealthy: this.lastHealthCheck.isHealthy,
        age: now - new Date(this.lastHealthCheck.timestamp).getTime()
      });
      return this.lastHealthCheck;
    }

    // Perform fresh health check
    const healthResult = await this.performHealthCheck();
    this.lastHealthCheck = healthResult;
    return healthResult;
  }

  private async performHealthCheck(): Promise<DatabaseHealthResult> {
    const startTime = Date.now();
    
    try {
      logger.debug(`[DB_HEALTH] Performing database health check`);
      
      // Test basic connectivity
      await sequelize.authenticate();
      
      // Test a simple query to ensure database is responsive
      await sequelize.query('SELECT 1 as test', { type: QueryTypes.SELECT });
      
      const connectionTime = Date.now() - startTime;
      
      const result: DatabaseHealthResult = {
        isHealthy: true,
        connectionTime,
        timestamp: new Date().toISOString()
      };

      logger.info(`[DB_HEALTH] Database health check passed`, {
        connectionTime: `${connectionTime}ms`,
        timestamp: result.timestamp
      });

      return result;
    } catch (error: any) {
      const connectionTime = Date.now() - startTime;
      
      const result: DatabaseHealthResult = {
        isHealthy: false,
        connectionTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      logger.error(`[DB_HEALTH] Database health check failed`, {
        error: error.message,
        connectionTime: `${connectionTime}ms`,
        timestamp: result.timestamp,
        errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });

      return result;
    }
  }

  public clearCache(): void {
    this.lastHealthCheck = null;
    logger.debug(`[DB_HEALTH] Health check cache cleared`);
  }
}

// Create singleton instance
const healthCache = new DatabaseHealthCache();

/**
 * Middleware to check database health before processing critical operations
 */
export const databaseHealthCheck = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.requestId || `health_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info(`[DB_HEALTH] Checking database health for request`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    treatmentId: req.params.id || req.params.treatmentId
  });

  try {
    const healthStatus = await healthCache.getHealthStatus();
    
    if (!healthStatus.isHealthy) {
      logger.error(`[DB_HEALTH] Database unhealthy, rejecting request`, {
        requestId,
        method: req.method,
        url: req.originalUrl,
        error: healthStatus.error,
        connectionTime: healthStatus.connectionTime
      });

      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'Database is currently unavailable. Please try again later.',
        details: {
          healthCheck: {
            timestamp: healthStatus.timestamp,
            connectionTime: healthStatus.connectionTime,
            // Don't expose internal error details to client
            error: 'Database connectivity issue'
          },
          retryAfter: '30 seconds'
        }
      });
    }

    // Log successful health check
    logger.debug(`[DB_HEALTH] Database health check passed for request`, {
      requestId,
      connectionTime: healthStatus.connectionTime,
      cached: healthStatus.timestamp !== new Date().toISOString()
    });

    // Warn for slow database connections
    if (healthStatus.connectionTime && healthStatus.connectionTime > 1000) {
      logger.warn(`[DB_HEALTH] Slow database connection detected`, {
        requestId,
        connectionTime: `${healthStatus.connectionTime}ms`,
        threshold: '1000ms',
        recommendation: 'Monitor database performance'
      });
    }

    next();
  } catch (error: any) {
    logger.error(`[DB_HEALTH] Health check middleware error`, {
      requestId,
      error: {
        message: error.message,
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });

    // If health check itself fails, still allow request but log warning
    logger.warn(`[DB_HEALTH] Health check failed, allowing request to proceed`, {
      requestId,
      method: req.method,
      url: req.originalUrl
    });

    next();
  }
};

/**
 * Enhanced middleware for critical database operations (like treatment/applicator creation)
 */
export const criticalOperationHealthCheck = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.requestId || `critical_${Math.random().toString(36).substr(2, 9)}`;
  
  logger.info(`[DB_HEALTH] Critical operation health check`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    operation: 'critical_database_operation'
  });

  try {
    // Clear cache for critical operations to ensure fresh check
    healthCache.clearCache();
    
    const healthStatus = await healthCache.getHealthStatus();
    
    if (!healthStatus.isHealthy) {
      logger.error(`[DB_HEALTH] Database unhealthy, blocking critical operation`, {
        requestId,
        method: req.method,
        url: req.originalUrl,
        error: healthStatus.error
      });

      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        message: 'Database is currently unavailable for critical operations. Please try again later.',
        details: {
          operation: 'critical_database_operation',
          healthCheck: {
            timestamp: healthStatus.timestamp,
            connectionTime: healthStatus.connectionTime
          },
          retryAfter: '60 seconds'
        }
      });
    }

    // Additional checks for critical operations
    if (healthStatus.connectionTime && healthStatus.connectionTime > 2000) {
      logger.warn(`[DB_HEALTH] High database latency for critical operation`, {
        requestId,
        connectionTime: `${healthStatus.connectionTime}ms`,
        threshold: '2000ms',
        operation: 'critical_database_operation'
      });
      
      // Consider rejecting if latency is too high for critical operations
      if (healthStatus.connectionTime > config.dbHealthThresholdMs) {
        logger.error(`[DB_HEALTH] Database latency too high, blocking critical operation`, {
          requestId,
          connectionTime: `${healthStatus.connectionTime}ms`,
          maxThreshold: `${config.dbHealthThresholdMs}ms`
        });

        return res.status(503).json({
          success: false,
          error: 'Service Unavailable',
          message: 'Database response time is too high for critical operations.',
          details: {
            connectionTime: `${healthStatus.connectionTime}ms`,
            maxAllowed: `${config.dbHealthThresholdMs}ms`,
            retryAfter: '30 seconds'
          }
        });
      }
    }

    logger.info(`[DB_HEALTH] Critical operation health check passed`, {
      requestId,
      connectionTime: healthStatus.connectionTime
    });

    next();
  } catch (error: any) {
    logger.error(`[DB_HEALTH] Critical operation health check error`, {
      requestId,
      error: {
        message: error.message,
        name: error.name
      }
    });

    // For critical operations, be more strict about errors
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Unable to verify database health for critical operation.',
      details: {
        operation: 'critical_database_operation',
        retryAfter: '60 seconds'
      }
    });
  }
};

/**
 * Utility function to manually check database health (for endpoints)
 */
export const getDatabaseHealthStatus = async (): Promise<DatabaseHealthResult> => {
  return await healthCache.getHealthStatus();
};

/**
 * Utility function to clear health cache (for testing or manual refresh)
 */
export const clearHealthCache = (): void => {
  healthCache.clearCache();
};