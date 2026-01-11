module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Centralized test location - IEC 62304 compliant structure
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/unit/**/*.test.ts',
    '**/integration/**/*.test.ts',
    '**/medical/**/*.test.ts',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      isolatedModules: true,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/dbInit.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'clover', 'json-summary'],
  // IEC 62304 Class B minimum thresholds
  // TODO: Raise thresholds to 50%+ once coverage is improved
  // Current coverage: ~34% (2026-01-11)
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
};