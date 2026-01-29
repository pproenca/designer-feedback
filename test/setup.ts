/**
 * Vitest setup file for unit tests
 * Uses WXT's fakeBrowser for browser API mocking
 */
import '@testing-library/jest-dom';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// Re-export fakeBrowser for test imports
export { fakeBrowser };

// Assign fakeBrowser to global browser and chrome objects
// WXT injects browser as a global, so tests need this
Object.defineProperty(globalThis, 'browser', {
  value: fakeBrowser,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'chrome', {
  value: fakeBrowser,
  writable: true,
  configurable: true,
});

// Reset fakeBrowser state between tests
beforeEach(() => {
  fakeBrowser.reset();
});
