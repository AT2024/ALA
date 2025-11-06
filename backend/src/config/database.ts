import { Sequelize } from 'sequelize';
import logger from '../utils/logger';

// Lazy getter for database URL
function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ala_db';
}

// Lazy getter for Sequelize configuration
function getSequelizeConfig() {
  return {
    dialect: 'postgres' as const,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: process.env.ENABLE_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10), // Maximum number of connections
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),  // Minimum number of connections
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10), // Max time to get connection (30s)
      idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10), // Max idle time (10s)
      evict: parseInt(process.env.DB_POOL_EVICT || '1000', 10) // Check for idle connections every 1s
    },
    retry: {
      max: 3, // Maximum retry attempts
      timeout: 5000, // Query timeout
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /TimeoutError/
      ]
    },
    define: {
      underscored: true,
      timestamps: true
    }
  };
}

// Create Sequelize instance with lazy-loaded configuration
const sequelize = new Sequelize(getDatabaseUrl(), getSequelizeConfig());

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailure: null,
  state: 'CLOSED'
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

// Check if circuit breaker allows connection attempts
const canAttemptConnection = (): boolean => {
  if (circuitBreaker.state === 'CLOSED') return true;
  if (circuitBreaker.state === 'OPEN') {
    const now = new Date();
    const timeSinceLastFailure = now.getTime() - (circuitBreaker.lastFailure?.getTime() || 0);
    if (timeSinceLastFailure > CIRCUIT_BREAKER_TIMEOUT) {
      circuitBreaker.state = 'HALF_OPEN';
      logger.info('Circuit breaker switching to HALF_OPEN state');
      return true;
    }
    return false;
  }
  return circuitBreaker.state === 'HALF_OPEN';
};

// Update circuit breaker state
const updateCircuitBreaker = (success: boolean): void => {
  if (success) {
    circuitBreaker.failures = 0;
    circuitBreaker.state = 'CLOSED';
    circuitBreaker.lastFailure = null;
  } else {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = new Date();
    if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreaker.state = 'OPEN';
      logger.warn(`Circuit breaker OPEN after ${circuitBreaker.failures} failures`);
    }
  }
};

// Initialize database connection with exponential backoff and circuit breaker
export const initializeDatabase = async (maxRetries = 5, initialDelay = 1000): Promise<boolean> => {
  let retryCount = 0;
  let delay = initialDelay;

  while (retryCount < maxRetries) {
    if (!canAttemptConnection()) {
      logger.warn('Circuit breaker is OPEN, skipping database connection attempt');
      return false;
    }

    try {
      if (retryCount > 0) {
        logger.info(`Retrying database connection (${retryCount}/${maxRetries}) after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // Test connection with timeout
      const connectionTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      );
      
      await Promise.race([
        sequelize.authenticate(),
        connectionTimeout
      ]);
      
      logger.info('Database connection established successfully');
      // Get pool configuration from environment variables for logging
      const poolMin = process.env.DB_POOL_MIN || '2';
      const poolMax = process.env.DB_POOL_MAX || '10';
      logger.info(`Connection pool: min=${poolMin}, max=${poolMax}`);
      
      // Sync models with database (only alter in development)
      await sequelize.sync({ 
        alter: process.env.NODE_ENV === 'development',
        force: false // Never drop tables
      });
      logger.info('Database models synchronized');
      
      updateCircuitBreaker(true);
      return true;
      
    } catch (error) {
      retryCount++;
      updateCircuitBreaker(false);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Database connection error (attempt ${retryCount}/${maxRetries}): ${errorMessage}`);
      
      if (retryCount >= maxRetries) {
        logger.error('Maximum database connection retries reached.');
        if (process.env.NODE_ENV === 'production') {
          logger.error('Server will exit as database is required in production');
          process.exit(1);
        } else {
          logger.warn('Server will continue without database in development mode');
          return false;
        }
      }
      
      // Exponential backoff: double the delay each time, with jitter
      const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
      delay = Math.min(delay * 2 + jitter, 30000); // Cap at 30 seconds
    }
  }
  
  return false;
};

// Graceful database shutdown
export const closeDatabase = async (): Promise<void> => {
  try {
    await sequelize.close();
    logger.info('Database connection closed gracefully');
  } catch (error) {
    logger.error(`Error closing database connection: ${error}`);
  }
};

// Health check function for database
export const checkDatabaseHealth = async (): Promise<boolean> => {
  if (!canAttemptConnection()) {
    return false;
  }

  try {
    await sequelize.authenticate();
    updateCircuitBreaker(true);
    return true;
  } catch (error) {
    updateCircuitBreaker(false);
    logger.error(`Database health check failed: ${error}`);
    return false;
  }
};

export default sequelize;
