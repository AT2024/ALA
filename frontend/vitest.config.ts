import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
    // Centralized test location - IEC 62304 compliant structure
    include: [
      'tests/**/*.test.{ts,tsx}',
      'tests/**/*.spec.{ts,tsx}',
      // Keep finding tests in old location during migration
      'src/**/__tests__/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'tests/e2e/**/*',
      'node_modules',
      // Skip in CI - SubtleCrypto not supported in GitHub Actions jsdom
      ...(process.env.CI === 'true' ? ['tests/unit/services/indexedDbService.test.ts'] : []),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'dist/',
        '.eslintrc.cjs',
        'postcss.config.js',
        'tailwind.config.js',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      // IEC 62304 Class B thresholds
      // TODO: Raise thresholds to 80%+ once coverage is improved
      // Current coverage: ~11-35% (2026-01-11)
      thresholds: {
        lines: 10,
        functions: 30,
        branches: 60,
        statements: 10,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
