/**
 * Vitest setup file for unit tests
 * Provides browser API mocks for unit testing
 */
import '@testing-library/jest-dom';
import { vi, type Mock } from 'vitest';

// Create a mock browser API for testing
const mockStorage: Record<string, unknown> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = Mock<(...args: any[]) => any>;

const mockBrowser = {
  runtime: {
    id: 'mock-extension-id',
    lastError: null as { message?: string } | null,
    sendMessage: vi.fn().mockResolvedValue(undefined) as AnyMock,
    getManifest: vi.fn(() => ({})),
    getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn().mockImplementation(async (keys: unknown) => {
        if (keys === null) return { ...mockStorage };
        if (typeof keys === 'string') return { [keys]: mockStorage[keys] };
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          for (const key of keys) {
            result[key] = mockStorage[key];
          }
          return result;
        }
        if (typeof keys === 'object' && keys !== null) {
          const result: Record<string, unknown> = {};
          for (const key of Object.keys(keys)) {
            result[key] = mockStorage[key] ?? (keys as Record<string, unknown>)[key];
          }
          return result;
        }
        return {};
      }),
      set: vi.fn().mockImplementation(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
      remove: vi.fn().mockImplementation(async (keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keysArray) {
          delete mockStorage[key];
        }
      }),
      getBytesInUse: vi.fn().mockResolvedValue(0),
      QUOTA_BYTES: 10485760, // 10MB
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
  },
  permissions: {
    contains: vi.fn().mockResolvedValue(true) as AnyMock,
    request: vi.fn().mockResolvedValue(true) as AnyMock,
  },
};

// Assign to global browser (WXT's API) and chrome (fallback)
Object.defineProperty(globalThis, 'browser', {
  value: mockBrowser,
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, 'chrome', {
  value: mockBrowser,
  writable: true,
  configurable: true,
});

// Helper to reset storage state between tests
export function resetMockStorage(): void {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
}

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  resetMockStorage();
  mockBrowser.runtime.lastError = null;
});

export { mockBrowser };
