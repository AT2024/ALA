import logger from '../utils/logger';

/**
 * Environment variable validation
 * Called after dotenv.config() to ensure all required environment variables are set
 */

interface RequiredEnvVar {
  name: string;
  description: string;
  required: boolean;
}

const envVars: RequiredEnvVar[] = [
  // Security
  { name: 'JWT_SECRET', description: 'JWT signing secret for authentication', required: true },

  // Database
  { name: 'DATABASE_URL', description: 'PostgreSQL connection string', required: true },

  // Priority API
  { name: 'PRIORITY_API_URL', description: 'Priority ERP API endpoint', required: true },
  { name: 'PRIORITY_API_USERNAME', description: 'Priority API username', required: true },
  { name: 'PRIORITY_API_PASSWORD', description: 'Priority API password', required: true },

  // Optional but recommended
  { name: 'NODE_ENV', description: 'Environment (development/production)', required: false },
  { name: 'PORT', description: 'Server port', required: false },
  { name: 'ENABLE_SSL', description: 'Enable SSL for database', required: false },
  { name: 'VITE_API_URL', description: 'Frontend API URL', required: false },
];

/**
 * Validate that all required environment variables are set
 * @throws Error if critical environment variables are missing
 */
export function validateEnvironment(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  logger.info('🔍 Validating environment variables...');

  envVars.forEach(({ name, description, required }) => {
    const value = process.env[name];

    if (!value || value.trim() === '') {
      if (required) {
        missing.push(`${name} (${description})`);
      } else {
        warnings.push(`${name} (${description})`);
      }
    } else {
      // Mask sensitive values in logs
      const maskedValue = name.includes('PASSWORD') || name.includes('SECRET')
        ? '***REDACTED***'
        : value;
      logger.debug(`✅ ${name}: ${maskedValue}`);
    }
  });

  // Log warnings for optional variables
  if (warnings.length > 0) {
    logger.warn('⚠️ Optional environment variables not set:');
    warnings.forEach(warning => logger.warn(`  - ${warning}`));
  }

  // Throw error if critical variables are missing
  if (missing.length > 0) {
    logger.error('❌ CRITICAL: Required environment variables are missing:');
    missing.forEach(variable => logger.error(`  - ${variable}`));
    throw new Error(
      `Missing required environment variables: ${missing.map(v => v.split(' ')[0]).join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }

  logger.info('✅ Environment validation passed');
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo(): Record<string, any> {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '5000',
    databaseConfigured: !!process.env.DATABASE_URL,
    priorityApiConfigured: !!(process.env.PRIORITY_API_URL && process.env.PRIORITY_API_USERNAME),
    sslEnabled: process.env.ENABLE_SSL === 'true',
  };
}
