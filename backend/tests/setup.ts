// Test setup file - runs before all tests
import { Sequelize } from 'sequelize';
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.DB_HOST = 'localhost';
process.env.DB_NAME = 'medical_app_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASS = 'test_password';
process.env.PRIORITY_URL = 'https://test.priority.api/odata';
process.env.PRIORITY_API_URL = 'https://test.priority.api/odata';
process.env.PRIORITY_USERNAME = 'TEST_API';
process.env.PRIORITY_API_USERNAME = 'TEST_API';
process.env.PRIORITY_PASSWORD = 'test_password';
process.env.PRIORITY_API_PASSWORD = 'test_password';
process.env.PRIORITY_API_COMPANY = 'test_company';
process.env.ENABLE_TEST_DATA = 'true';
process.env.BYPASS_PRIORITY_EMAILS = 'test@example.com,test@bypass.com';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock logger to prevent actual log outputs during tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Global test database instance
let testSequelize: Sequelize;

// Setup test database before all tests
beforeAll(async () => {
  // Connect to PostgreSQL test database
  testSequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'medical_app_test',
    username: process.env.DB_USER || 'test_user',
    password: process.env.DB_PASS || 'test_password',
    logging: false, // Disable SQL logging in tests
  });

  // Test database connection
  try {
    await testSequelize.authenticate();
  } catch (error) {
    console.error('Unable to connect to test database:', error);
  }
});

// Cleanup after all tests
afterAll(async () => {
  if (testSequelize) {
    await testSequelize.close();
  }
});

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// Export test utilities
export { testSequelize };