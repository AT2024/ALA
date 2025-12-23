/**
 * HTTPS Configuration
 * Centralizes HTTPS-related settings and URL generation
 * All values come from environment variables with sensible defaults
 */

export interface HttpsConfig {
  useHttps: boolean;
  domain: string;
  protocol: string;
  apiPort: number;
  frontendPort: number;
  sslCertPath?: string;
  sslKeyPath?: string;
  hstsEnabled: boolean;
  hstsMaxAge: number;
  devFrontendUrl: string;
}

/**
 * Get HTTPS configuration from environment variables
 */
export const getHttpsConfig = (): HttpsConfig => {
  return {
    useHttps: process.env.USE_HTTPS === 'true',
    domain: process.env.DOMAIN || 'localhost',
    protocol: process.env.USE_HTTPS === 'true' ? 'https' : 'http',
    apiPort: parseInt(process.env.API_PORT || '5000', 10),
    frontendPort: parseInt(process.env.FRONTEND_PORT || '3000', 10),
    sslCertPath: process.env.SSL_CERT_PATH,
    sslKeyPath: process.env.SSL_KEY_PATH,
    hstsEnabled: process.env.HSTS_ENABLED === 'true',
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10),
    devFrontendUrl: process.env.DEV_FRONTEND_URL || 'http://localhost:3000'
  };
};

/**
 * Generate API URL based on HTTPS configuration
 */
export const getApiUrl = (): string => {
  const config = getHttpsConfig();
  return `${config.protocol}://${config.domain}:${config.apiPort}/api`;
};

/**
 * Generate frontend URL based on HTTPS configuration
 */
export const getFrontendUrl = (): string => {
  const config = getHttpsConfig();
  return `${config.protocol}://${config.domain}:${config.frontendPort}`;
};

/**
 * Get CORS origins based on HTTPS configuration
 */
export const getCorsOrigins = (): string[] => {
  const config = getHttpsConfig();
  const baseOrigins = [
    getFrontendUrl(),
    config.devFrontendUrl, // Allow local development via env var
  ];

  // Add CORS_ORIGIN from environment if specified
  if (process.env.CORS_ORIGIN) {
    baseOrigins.push(...process.env.CORS_ORIGIN.split(','));
  }

  return baseOrigins.filter((origin, index, arr) => arr.indexOf(origin) === index); // Remove duplicates
};

/**
 * Check if current environment should enforce HTTPS
 */
export const shouldEnforceHttps = (): boolean => {
  const config = getHttpsConfig();
  return process.env.NODE_ENV === 'production' && config.useHttps;
};

export default {
  getHttpsConfig,
  getApiUrl,
  getFrontendUrl,
  getCorsOrigins,
  shouldEnforceHttps
};