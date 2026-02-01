import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // Map browser import to fakeBrowser for testing
      'wxt/browser': 'wxt/testing/fake-browser',
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    mockReset: true,
    restoreMocks: true,
    execArgv: ['--experimental-require-module'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'tests/**', // Exclude Playwright E2E tests
      '.output/**',
      '.wxt/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
