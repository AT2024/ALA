/**
 * Centralized Application Configuration
 *
 * All configuration values should be loaded from environment variables.
 * This module provides typed access to configuration with sensible defaults.
 */

export const config = {
  // URLs and networking
  domain: process.env.DOMAIN || 'localhost',
  apiPort: parseInt(process.env.API_PORT || '5000', 10),
  frontendPort: parseInt(process.env.FRONTEND_PORT || '3000', 10),

  // Priority API
  priorityApiTimeout: parseInt(process.env.PRIORITY_API_TIMEOUT_MS || '30000', 10),
  priorityApiShortTimeout: parseInt(process.env.PRIORITY_API_SHORT_TIMEOUT_MS || '10000', 10),

  // Logging thresholds
  slowRequestThresholdMs: parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '5000', 10),
  slowResponseThresholdMs: parseInt(process.env.SLOW_RESPONSE_THRESHOLD_MS || '3000', 10),

  // Database health
  dbHealthCacheMs: parseInt(process.env.DB_HEALTH_CACHE_MS || '300000', 10),
  dbHealthThresholdMs: parseInt(process.env.DB_HEALTH_THRESHOLD_MS || '5000', 10),
  dbReconnectIntervalMs: parseInt(process.env.DB_RECONNECT_INTERVAL_MS || '30000', 10),

  // Email (retry configuration)
  emailMaxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3', 10),
  emailRetryDelayMs: parseInt(process.env.EMAIL_RETRY_DELAY_MS || '1000', 10),

  // Test user configuration
  testUserEmail: process.env.TEST_USER_EMAIL || 'test@example.com',
  testUserUuid: process.env.TEST_USER_UUID || '47605b24-e71b-479b-93c5-8b7ce1c17098',
};

export default config;
