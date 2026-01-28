import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hasScreenshotPermission, requestScreenshotPermission } from './permissions';
import { mockChrome } from '../test/setup';

describe('permissions utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasScreenshotPermission', () => {
    it('returns true when permission is granted', async () => {
      mockChrome.permissions.contains.mockImplementation((perms, callback) => {
        expect(perms).toEqual({ origins: ['<all_urls>'] });
        callback(true);
      });

      const result = await hasScreenshotPermission();
      expect(result).toBe(true);
      expect(mockChrome.permissions.contains).toHaveBeenCalledTimes(1);
    });

    it('returns false when permission is not granted', async () => {
      mockChrome.permissions.contains.mockImplementation((_perms, callback) => {
        callback(false);
      });

      const result = await hasScreenshotPermission();
      expect(result).toBe(false);
    });
  });

  describe('requestScreenshotPermission', () => {
    it('returns true when user grants permission', async () => {
      mockChrome.permissions.request.mockImplementation((perms, callback) => {
        expect(perms).toEqual({ origins: ['<all_urls>'] });
        callback(true);
      });

      const result = await requestScreenshotPermission();
      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledTimes(1);
    });

    it('returns false when user denies permission', async () => {
      mockChrome.permissions.request.mockImplementation((_perms, callback) => {
        callback(false);
      });

      const result = await requestScreenshotPermission();
      expect(result).toBe(false);
    });
  });
});
