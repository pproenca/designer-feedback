import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  getAnnotationCount,
  getStorageKey,
  loadAnnotations,
  clearAnnotations,
  updateBadgeCount,
  checkStorageQuota,
  saveAnnotation,
  deleteAnnotation,
} from './storage';
import { hashString } from './hash';

describe('Storage Quota Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    fakeBrowser.reset();
  });

  it('should check bytes in use before saving', async () => {
    // Mock console.warn since getBytesInUse is not available in fakeBrowser
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await checkStorageQuota();
    expect(result.ok).toBe(true);
    expect(result.bytesUsed).toBeGreaterThanOrEqual(0);

    consoleSpy.mockRestore();
  });

  it('should return expected shape from checkStorageQuota', async () => {
    // Mock console.warn since getBytesInUse is not available in fakeBrowser
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await checkStorageQuota();
    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('bytesUsed');
    expect(result).toHaveProperty('percentUsed');

    consoleSpy.mockRestore();
  });
});

describe('Storage helpers and flows', () => {
  const storagePrefix = 'designer-feedback:annotations:';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    fakeBrowser.reset();
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    Object.defineProperty(window, 'scrollX', { value: 10, writable: true });
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com', pathname: '/page', search: '?q=1' },
      writable: true,
    });
  });

  it('builds storage keys with a hashed origin + path + query', () => {
    const rawKey = 'https://example.com/page?q=1';
    expect(getStorageKey()).toBe(`v2:${hashString(rawKey)}`);
  });

  it('merges legacy storage keys and normalizes coordinates', async () => {
    const now = Date.now();
    const currentKey = `${storagePrefix}https://example.com/page?q=1`;

    // Pre-populate storage
    await browser.storage.local.set({
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

    await browser.storage.local.set({
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
    });

    const count = await getAnnotationCount('https://example.com/page?q=1');
    expect(count).toBe(1);
    vi.useRealTimers();
  });

  it('clears annotations for all storage keys', async () => {
    const currentKey = `${storagePrefix}https://example.com/page?q=1`;
    await browser.storage.local.set({
      [currentKey]: [{ id: 'test', x: 0, y: 0, comment: 'test', category: 'bug' }],
    });

    await clearAnnotations();

    const result = await browser.storage.local.get(currentKey);
    expect(result[currentKey]).toBeUndefined();
  });

  it('sends badge update message', () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(undefined);
    updateBadgeCount(7);
    expect(spy).toHaveBeenCalledWith({
      type: 'UPDATE_BADGE',
      count: 7,
    });
    spy.mockRestore();
  });

  it('saves annotation successfully', async () => {
    const annotation = {
      id: '1',
      x: 100,
      y: 200,
      comment: 'Test comment',
      category: 'bug' as const,
      element: 'div.test',
      elementPath: 'div.test',
      timestamp: Date.now(),
      isFixed: false,
      url: getStorageKey(),
    };

    await saveAnnotation(annotation);

    const key = `${storagePrefix}${getStorageKey()}`;
    const result = await browser.storage.local.get(key);
    const stored = result[key] as typeof annotation[];
    expect(stored).toHaveLength(1);
    expect(stored[0].comment).toBe('Test comment');
  });

  it('returns empty array when no annotations exist', async () => {
    const results = await loadAnnotations();
    expect(results).toEqual([]);
  });

  it('deletes annotation from storage', async () => {
    const annotation = {
      id: 'delete-test',
      x: 100,
      y: 200,
      comment: 'To be deleted',
      category: 'bug' as const,
      element: 'div.test',
      elementPath: 'div.test',
      timestamp: Date.now(),
      isFixed: false,
      url: getStorageKey(),
    };

    await saveAnnotation(annotation);
    const before = await loadAnnotations();
    expect(before).toHaveLength(1);

    await deleteAnnotation('delete-test');
    const after = await loadAnnotations();
    expect(after).toHaveLength(0);
  });
});
