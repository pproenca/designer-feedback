import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetMockStorage } from '../test/setup';
import { hasScreenshotPermission, requestScreenshotPermission } from './permissions';

describe('permissions utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStorage();
    vi.spyOn(browser.runtime, 'getManifest').mockReturnValue({
      optional_host_permissions: ['<all_urls>'],
    } as ReturnType<typeof browser.runtime.getManifest>);
  });

  describe('hasScreenshotPermission', () => {
    it('returns true when permission is granted', async () => {
      const spy = vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true);

      const result = await hasScreenshotPermission();
      expect(result).toBe(true);
      expect(browser.permissions.contains).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    it('returns false when permission is not granted', async () => {
      const spy = vi.spyOn(browser.permissions, 'contains').mockResolvedValue(false);

      const result = await hasScreenshotPermission();
      expect(result).toBe(false);

      spy.mockRestore();
    });

    it('returns true when optional host permissions are not declared', async () => {
      vi.spyOn(browser.runtime, 'getManifest').mockReturnValue(
        {} as ReturnType<typeof browser.runtime.getManifest>
      );
      const containsSpy = vi.spyOn(browser.permissions, 'contains');

      const result = await hasScreenshotPermission();
      expect(result).toBe(true);
      expect(containsSpy).not.toHaveBeenCalled();

      containsSpy.mockRestore();
    });
  });

  describe('requestScreenshotPermission', () => {
    it('returns true when user grants permission', async () => {
      const spy = vi.spyOn(browser.permissions, 'request').mockResolvedValue(true);

      const result = await requestScreenshotPermission();
      expect(result).toBe(true);
      expect(browser.permissions.request).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    it('returns false when user denies permission', async () => {
      const spy = vi.spyOn(browser.permissions, 'request').mockResolvedValue(false);

      const result = await requestScreenshotPermission();
      expect(result).toBe(false);

      spy.mockRestore();
    });

    it('returns true when optional host permissions are not declared', async () => {
      vi.spyOn(browser.runtime, 'getManifest').mockReturnValue(
        {} as ReturnType<typeof browser.runtime.getManifest>
      );
      const requestSpy = vi.spyOn(browser.permissions, 'request');

      const result = await requestScreenshotPermission();
      expect(result).toBe(true);
      expect(requestSpy).not.toHaveBeenCalled();

      requestSpy.mockRestore();
    });
  });
});
