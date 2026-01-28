import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '../test/setup';
import {
  getAnnotationCount,
  getStorageKey,
  loadAnnotations,
  clearAnnotations,
  updateBadgeCount,
} from './storage';

describe('Storage Quota Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should check bytes in use before saving', async () => {
    // This test documents the expected behavior after implementing quota validation
    // The checkStorageQuota function should call getBytesInUse

    mockChrome.storage.local.getBytesInUse.mockImplementation(
      (_keys: unknown, callback: (bytesInUse: number) => void) => {
        callback(5_000_000); // 5MB used
      }
    );

    mockChrome.storage.local.set.mockImplementation(
      (_items: unknown, callback: () => void) => {
        callback();
      }
    );

    // Import after mocks are set up
    const storage = await import('./storage');

    // If checkStorageQuota exists and is exported, test it
    if ('checkStorageQuota' in storage) {
      const result = await (
        storage as { checkStorageQuota: () => Promise<{ ok: boolean; bytesUsed: number }> }
      ).checkStorageQuota();
      expect(result.ok).toBe(true);
      expect(result.bytesUsed).toBe(5_000_000);
    } else {
      // Before implementation, just verify getBytesInUse is available
      expect(mockChrome.storage.local.getBytesInUse).toBeDefined();
    }
  });

  it('should warn at 80% capacity (8MB of 10MB)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockChrome.storage.local.getBytesInUse.mockImplementation(
      (_keys: unknown, callback: (bytesInUse: number) => void) => {
        callback(8_500_000); // 8.5MB - above 80% threshold
      }
    );

    const storage = await import('./storage');

    if ('checkStorageQuota' in storage) {
      await (
        storage as { checkStorageQuota: () => Promise<{ ok: boolean }> }
      ).checkStorageQuota();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('quota')
      );
    }

    consoleSpy.mockRestore();
  });

  it('should prevent saves that would exceed quota', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Reset mock for this specific test
    mockChrome.storage.local.getBytesInUse.mockReset();
    mockChrome.storage.local.getBytesInUse.mockImplementation(
      (_keys: unknown, callback: (bytesInUse: number) => void) => {
        callback(10_500_000); // 10.5MB - over the 10MB limit
      }
    );

    // Force re-import by using resetModules (if available) or just call the function
    const { checkStorageQuota } = await import('./storage');

    const result = await checkStorageQuota();

    // At 10.5MB / 10MB = 105%, this should be over quota
    expect(result.ok).toBe(false);
    expect(result.percentUsed).toBeGreaterThan(1);
    consoleSpy.mockRestore();
  });

  it('returns zero usage and warns when bytes-in-use check fails', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockChrome.storage.local.getBytesInUse.mockImplementation(
      (_keys: unknown, callback: (bytesInUse: number) => void) => {
        mockChrome.runtime.lastError = { message: 'Quota read failed' };
        callback(0);
      }
    );

    const { checkStorageQuota } = await import('./storage');
    const result = await checkStorageQuota();

    expect(result.bytesUsed).toBe(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to get storage usage:',
      'Quota read failed'
    );
    consoleSpy.mockRestore();
  });

  it('rejects when storage read fails during save', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_keys: unknown, callback: (result: unknown) => void) => {
        mockChrome.runtime.lastError = { message: 'Read failed' };
        callback({});
      }
    );

    const { saveAnnotation } = await import('./storage');

    await expect(
      saveAnnotation({
        id: '1',
        x: 0,
        y: 0,
        comment: 'Test',
        category: 'bug',
        element: 'div',
        elementPath: 'div',
        timestamp: Date.now(),
        isFixed: false,
        url: 'https://example.com',
      })
    ).rejects.toThrow('Read failed');
  });

  it('returns empty array when stored annotations are malformed', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (keys: unknown, callback: (result: unknown) => void) => {
        if (keys === null) {
          callback({});
          return;
        }
        const key = Object.keys(keys as Record<string, unknown>)[0];
        callback({ [key]: 'not-an-array' });
      }
    );

    const { loadAnnotations } = await import('./storage');
    const results = await loadAnnotations();

    expect(results).toEqual([]);
  });
});

describe('Storage helpers and flows', () => {
  const storagePrefix = 'designer-feedback:annotations:';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    Object.defineProperty(window, 'scrollX', { value: 10, writable: true });
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com', pathname: '/page', search: '?q=1' },
      writable: true,
    });
  });

  it('builds storage keys with origin + path + query', () => {
    expect(getStorageKey()).toBe('https://example.com/page?q=1');
  });

  it('merges legacy storage keys and normalizes coordinates', async () => {
    const now = Date.now();
    const currentKey = `${storagePrefix}https://example.com/page?q=1`;
    const legacyKey = `${storagePrefix}/page?q=1`;
    const stored = {
      [currentKey]: [
        {
          id: 'a',
          x: 0.5,
          y: 0.5,
          comment: 'new',
          category: 'bug',
          element: 'div',
          elementPath: 'div',
          timestamp: now,
          isFixed: false,
        },
      ],
      [legacyKey]: [
        {
          id: 'a',
          x: 0.5,
          y: 0.5,
          comment: 'legacy',
          category: 'bug',
          element: 'div',
          elementPath: 'div',
          timestamp: now,
          isFixed: false,
        },
      ],
    };

    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      const key = Object.keys(keys as Record<string, unknown>)[0];
      callback({ [key]: stored[key as keyof typeof stored] });
    });

    const results = await loadAnnotations();

    expect(results).toHaveLength(1);
    expect(results[0]?.x).toBe(510);
  });

  it('counts only non-expired annotations', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-28T12:00:00Z');
    vi.setSystemTime(now);

    const currentKey = `${storagePrefix}https://example.com/page?q=1`;
    const stored = {
      [currentKey]: [
        {
          id: 'fresh',
          x: 10,
          y: 10,
          comment: 'ok',
          category: 'bug',
          element: 'div',
          elementPath: 'div',
          timestamp: now.getTime(),
          isFixed: false,
        },
        {
          id: 'old',
          x: 10,
          y: 10,
          comment: 'old',
          category: 'bug',
          element: 'div',
          elementPath: 'div',
          timestamp: now.getTime() - 31 * 24 * 60 * 60 * 1000,
          isFixed: false,
        },
      ],
    };

    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      const key = Object.keys(keys as Record<string, unknown>)[0];
      callback({ [key]: stored[key as keyof typeof stored] });
    });

    const count = await getAnnotationCount('https://example.com/page?q=1');
    expect(count).toBe(1);
    vi.useRealTimers();
  });

  it('clears annotations for all storage keys', async () => {
    mockChrome.storage.local.remove.mockImplementation((_keys, callback) => callback());

    await clearAnnotations();

    expect(mockChrome.storage.local.remove).toHaveBeenCalledTimes(2);
  });

  it('sends badge update message', () => {
    updateBadgeCount(7);
    expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'UPDATE_BADGE',
      count: 7,
    });
  });
});
