/**
 * Vitest setup file for unit tests
 * Provides Chrome extension API mocks
 */
import { vi } from 'vitest';

// Mock chrome.runtime API
const mockChrome = {
  runtime: {
    lastError: null as { message?: string } | null,
    sendMessage: vi.fn(),
    getManifest: vi.fn(() => ({})),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      getBytesInUse: vi.fn(),
      QUOTA_BYTES: 10485760, // 10MB
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
  },
  permissions: {
    contains: vi.fn().mockImplementation((_perms, callback) => callback(true)),
    request: vi.fn().mockImplementation((_perms, callback) => callback(true)),
  },
};

// Assign to global (configurable so tests can override)
Object.defineProperty(globalThis, 'chrome', {
  value: mockChrome,
  writable: true,
  configurable: true,
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  mockChrome.runtime.lastError = null;
});

export { mockChrome };
