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
      // IEC 62304 Class B thresholds (80% minimum)
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
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
