/**
 * Unit tests for background-helpers.ts
 * Tests critical paths: captureVisibleTabScreenshot, downloadFile, tab tracking, settings, badge
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import {
  activatedTabs,
  settingsEnabled,
  settingsLightMode,
} from '@/utils/storage-items';
// Note: OFFSCREEN_DOCUMENT_PATH imported for downloadFile tests (commented out for now)

import {
  // URL utilities
  isInjectableUrl,
  getOrigin,
  getOriginHash,
  getOriginPattern,
  normalizeOriginHash,
  // Screenshot
  captureVisibleTabScreenshot,
  getWindowIdForCapture,
  verifyScreenshotPermission,
  // Download - skip for now as it requires offscreen document mocking
  // Settings
  getSettings,
  saveSettings,
  // Badge
  updateBadge,
  // Security
  isExtensionSender,
  // Tab tracking
  persistActivatedTabs,
  restoreActivatedTabs,
  hasOptionalHostPermissions,
  ensureHostPermission,
  getContentScriptFiles,
} from './background-helpers';
import { hashString } from './hash';

describe('Background Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================================
  // URL Utilities
  // =============================================================================

  describe('URL Utilities', () => {
    describe('isInjectableUrl', () => {
      it('returns true for http URLs', () => {
        expect(isInjectableUrl('http://example.com')).toBe(true);
        expect(isInjectableUrl('http://localhost:3000')).toBe(true);
      });

      it('returns true for https URLs', () => {
        expect(isInjectableUrl('https://example.com')).toBe(true);
        expect(isInjectableUrl('https://localhost:3000')).toBe(true);
      });

      it('returns false for chrome:// URLs', () => {
        expect(isInjectableUrl('chrome://extensions')).toBe(false);
        expect(isInjectableUrl('chrome://newtab')).toBe(false);
      });

      it('returns false for chrome-extension:// URLs', () => {
        expect(isInjectableUrl('chrome-extension://abc123/popup.html')).toBe(false);
      });

      it('returns false for about: URLs', () => {
        expect(isInjectableUrl('about:blank')).toBe(false);
        expect(isInjectableUrl('about:newtab')).toBe(false);
      });

      it('returns false for file:// URLs', () => {
        expect(isInjectableUrl('file:///path/to/file.html')).toBe(false);
      });
    });

    describe('getOrigin', () => {
      it('extracts origin from valid URLs', () => {
        expect(getOrigin('https://example.com/path?query=1')).toBe('https://example.com');
        expect(getOrigin('http://localhost:3000/page')).toBe('http://localhost:3000');
      });

      it('returns empty string for invalid URLs', () => {
        expect(getOrigin('not a url')).toBe('');
        expect(getOrigin('')).toBe('');
      });
    });

    describe('getOriginHash', () => {
      it('returns consistent hash for same origin', () => {
        const hash1 = getOriginHash('https://example.com');
        const hash2 = getOriginHash('https://example.com');
        expect(hash1).toBe(hash2);
      });

      it('returns different hash for different origins', () => {
        const hash1 = getOriginHash('https://example.com');
        const hash2 = getOriginHash('https://other.com');
        expect(hash1).not.toBe(hash2);
      });
    });

    describe('getOriginPattern', () => {
      it('adds wildcard suffix to origin', () => {
        expect(getOriginPattern('https://example.com')).toBe('https://example.com/*');
        expect(getOriginPattern('http://localhost:3000')).toBe('http://localhost:3000/*');
      });
    });

    describe('normalizeOriginHash', () => {
      it('hashes full URLs with protocol', () => {
        const url = 'https://example.com';
        expect(normalizeOriginHash(url)).toBe(hashString(url));
      });

      it('returns hash unchanged if already hashed', () => {
        const hash = 'abc123';
        expect(normalizeOriginHash(hash)).toBe(hash);
      });
    });
  });

  // =============================================================================
  // Screenshot Capture
  // =============================================================================

  describe('captureVisibleTabScreenshot', () => {
    it('returns data URL on success', async () => {
      const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
      vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockResolvedValue(testDataUrl);

      const result = await captureVisibleTabScreenshot(1);

      expect(result.data).toBe(testDataUrl);
      expect(result.error).toBeUndefined();
    });

    it('returns error when captureVisibleTab fails', async () => {
      vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockRejectedValue(
        new Error('Tab capture failed')
      );
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await captureVisibleTabScreenshot(1);

      expect(result.data).toBe('');
      expect(result.error).toContain('Tab capture failed');
      expect(consoleSpy).toHaveBeenCalledWith('[Background] captureVisibleTab failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('returns error when captureVisibleTab returns empty', async () => {
      vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockResolvedValue('');

      const result = await captureVisibleTabScreenshot(1);

      expect(result.data).toBe('');
      expect(result.error).toBe('captureVisibleTab returned empty');
    });

    it('passes correct windowId and format options', async () => {
      const captureVisibleTabSpy = vi
        .spyOn(fakeBrowser.tabs, 'captureVisibleTab')
        .mockResolvedValue('data:image/png;base64,test');

      await captureVisibleTabScreenshot(42);

      expect(captureVisibleTabSpy).toHaveBeenCalledWith(42, { format: 'png' });
    });
  });

  describe('getWindowIdForCapture', () => {
    it('returns sender.tab.windowId when provided', async () => {
      const windowId = await getWindowIdForCapture(42);
      expect(windowId).toBe(42);
    });

    it('queries active tab when sender.tab.windowId is undefined', async () => {
      vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
        { id: 1, windowId: 99, url: 'https://example.com' },
      ]);

      const windowId = await getWindowIdForCapture(undefined);

      expect(fakeBrowser.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(windowId).toBe(99);
    });

    it('returns WINDOW_ID_CURRENT when active tab query returns empty', async () => {
      vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([]);

      const windowId = await getWindowIdForCapture(undefined);

      expect(windowId).toBe(fakeBrowser.windows.WINDOW_ID_CURRENT);
    });

    it('returns WINDOW_ID_CURRENT when active tab has no windowId', async () => {
      vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
        { id: 1, url: 'https://example.com' }, // no windowId
      ]);

      const windowId = await getWindowIdForCapture(undefined);

      expect(windowId).toBe(fakeBrowser.windows.WINDOW_ID_CURRENT);
    });

    it('returns WINDOW_ID_CURRENT when tab query fails', async () => {
      vi.spyOn(fakeBrowser.tabs, 'query').mockRejectedValue(new Error('Query failed'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const windowId = await getWindowIdForCapture(undefined);

      expect(windowId).toBe(fakeBrowser.windows.WINDOW_ID_CURRENT);
      expect(consoleSpy).toHaveBeenCalledWith('[Background] Failed to query active tab:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('verifyScreenshotPermission', () => {
    it('returns true when permission is granted', async () => {
      vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(true);

      const result = await verifyScreenshotPermission('https://example.com/page');

      expect(result).toBe(true);
      expect(fakeBrowser.permissions.contains).toHaveBeenCalledWith({
        origins: ['https://example.com/*'],
      });
    });

    it('returns false when permission is not granted', async () => {
      vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(false);

      const result = await verifyScreenshotPermission('https://example.com/page');

      expect(result).toBe(false);
    });

    it('returns false for invalid URLs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await verifyScreenshotPermission('not-a-valid-url');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[Background] Permission check failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('returns false when permission check throws', async () => {
      vi.spyOn(fakeBrowser.permissions, 'contains').mockRejectedValue(new Error('Permission error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await verifyScreenshotPermission('https://example.com/page');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[Background] Permission check failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // Settings Management
  // =============================================================================

  describe('Settings Management', () => {
    describe('getSettings', () => {
      it('returns settings from sync storage', async () => {
        const customSettings: Settings = { enabled: false, lightMode: false };
        await settingsEnabled.setValue(customSettings.enabled);
        await settingsLightMode.setValue(customSettings.lightMode);

        const result = await getSettings();

        expect(result.settings).toEqual(customSettings);
        expect(result.error).toBeUndefined();
      });

      it('returns default settings when storage fails', async () => {
        vi.spyOn(settingsEnabled, 'getValue').mockRejectedValue(new Error('Storage error'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await getSettings();

        expect(result.settings).toEqual(DEFAULT_SETTINGS);
        expect(result.error).toContain('Storage error');
        expect(consoleSpy).toHaveBeenCalledWith('Failed to get settings:', expect.any(Error));
        consoleSpy.mockRestore();
      });
    });

    describe('saveSettings', () => {
      it('saves settings to sync storage', async () => {
        const newSettings: Settings = { enabled: false, lightMode: true };
        const enabledSpy = vi.spyOn(settingsEnabled, 'setValue').mockResolvedValue(undefined);
        const lightModeSpy = vi.spyOn(settingsLightMode, 'setValue').mockResolvedValue(undefined);

        const result = await saveSettings(newSettings);

        expect(enabledSpy).toHaveBeenCalledWith(false);
        expect(lightModeSpy).toHaveBeenCalledWith(true);
        expect(result.settings).toEqual(newSettings);
        expect(result.error).toBeUndefined();
      });

      it('returns error when saving fails', async () => {
        vi.spyOn(settingsEnabled, 'setValue').mockRejectedValue(new Error('Quota exceeded'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await saveSettings(DEFAULT_SETTINGS);

        expect(result.settings).toEqual(DEFAULT_SETTINGS);
        expect(result.error).toContain('Quota exceeded');
        expect(consoleSpy).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error));
        consoleSpy.mockRestore();
      });
    });
  });

  // =============================================================================
  // Badge Updates
  // =============================================================================

  describe('Badge Updates', () => {
    it('sets badge text and color for non-zero count', () => {
      vi.spyOn(fakeBrowser.action, 'setBadgeText').mockResolvedValue(undefined);
      vi.spyOn(fakeBrowser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);

      updateBadge(5);

      expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: '5' });
      expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#3C82F7',
      });
    });

    it('clears badge text for zero count', () => {
      vi.spyOn(fakeBrowser.action, 'setBadgeText').mockResolvedValue(undefined);
      vi.spyOn(fakeBrowser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);

      updateBadge(0);

      expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
      // setBadgeBackgroundColor should NOT be called for zero count
      expect(fakeBrowser.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    });

    it('handles large counts', () => {
      vi.spyOn(fakeBrowser.action, 'setBadgeText').mockResolvedValue(undefined);
      vi.spyOn(fakeBrowser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);

      updateBadge(999);

      expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({ text: '999' });
    });
  });

  // =============================================================================
  // Security
  // =============================================================================

  describe('Security', () => {
    describe('isExtensionSender', () => {
      it('returns true for matching extension ID', () => {
        const extensionId = 'test-extension-id';
        Object.defineProperty(fakeBrowser.runtime, 'id', {
          value: extensionId,
          configurable: true,
        });

        expect(isExtensionSender({ id: extensionId })).toBe(true);
      });

      it('returns false for non-matching extension ID', () => {
        Object.defineProperty(fakeBrowser.runtime, 'id', {
          value: 'my-extension-id',
          configurable: true,
        });

        expect(isExtensionSender({ id: 'malicious-extension' })).toBe(false);
      });

      it('returns false for undefined sender ID', () => {
        Object.defineProperty(fakeBrowser.runtime, 'id', {
          value: 'my-extension-id',
          configurable: true,
        });

        expect(isExtensionSender({})).toBe(false);
      });
    });
  });

  // =============================================================================
  // Tab Tracking
  // =============================================================================

  describe('Tab Tracking', () => {
    describe('persistActivatedTabs', () => {
      it('persists tabs to session storage', () => {
        const setSpy = vi.spyOn(activatedTabs, 'setValue').mockResolvedValue(undefined);

        const tabs = new Map<number, string>();
        tabs.set(1, 'hash1');
        tabs.set(2, 'hash2');

        persistActivatedTabs(tabs);

        expect(setSpy).toHaveBeenCalledWith({ '1': 'hash1', '2': 'hash2' });
      });

      it('persists empty map as empty object', () => {
        const setSpy = vi.spyOn(activatedTabs, 'setValue').mockResolvedValue(undefined);

        const tabs = new Map<number, string>();

        persistActivatedTabs(tabs);

        expect(setSpy).toHaveBeenCalledWith({});
      });
    });

    describe('restoreActivatedTabs', () => {
      it('restores tabs from session storage', async () => {
        vi.spyOn(activatedTabs, 'getValue').mockResolvedValue({
          '1': 'hash1',
          '2': 'hash2',
        });
        vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
          { id: 1, url: 'https://example.com' },
          { id: 2, url: 'https://other.com' },
        ]);

        const tabs = new Map<number, string>();
        await restoreActivatedTabs(tabs);

        expect(tabs.get(1)).toBe('hash1');
        expect(tabs.get(2)).toBe('hash2');
      });

      it('removes tabs that no longer exist', async () => {
        vi.spyOn(activatedTabs, 'getValue').mockResolvedValue({
          '1': 'hash1',
          '999': 'hash999',
        });
        vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
          { id: 1, url: 'https://example.com' },
        ]);

        const tabs = new Map<number, string>();
        const changed = await restoreActivatedTabs(tabs);

        expect(tabs.has(1)).toBe(true);
        expect(tabs.has(999)).toBe(false);
        expect(changed).toBe(true);
      });

      it('normalizes origin hashes that are full URLs', async () => {
        const fullUrl = 'https://example.com';
        const expectedHash = hashString(fullUrl);

        vi.spyOn(activatedTabs, 'getValue').mockResolvedValue({ '1': fullUrl });
        vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
          { id: 1, url: 'https://example.com' },
        ]);

        const tabs = new Map<number, string>();
        const changed = await restoreActivatedTabs(tabs);

        expect(tabs.get(1)).toBe(expectedHash);
        expect(changed).toBe(true);
      });

      it('returns false when nothing changed', async () => {
        const hash = 'alreadyhashed123';
        vi.spyOn(activatedTabs, 'getValue').mockResolvedValue({ '1': hash });
        vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([
          { id: 1, url: 'https://example.com' },
        ]);

        const tabs = new Map<number, string>();
        const changed = await restoreActivatedTabs(tabs);

        expect(tabs.get(1)).toBe(hash);
        expect(changed).toBe(false);
      });
    });

    describe('hasOptionalHostPermissions', () => {
      it('returns true when manifest has optional_host_permissions', () => {
        vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
          manifest_version: 3,
          name: 'Test',
          version: '1.0',
          optional_host_permissions: ['*://*/*'],
        });

        expect(hasOptionalHostPermissions()).toBe(true);
      });

      it('returns false when manifest has empty optional_host_permissions', () => {
        vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
          manifest_version: 3,
          name: 'Test',
          version: '1.0',
          optional_host_permissions: [],
        });

        expect(hasOptionalHostPermissions()).toBe(false);
      });

      it('returns false when manifest has no optional_host_permissions', () => {
        vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
          manifest_version: 3,
          name: 'Test',
          version: '1.0',
        });

        expect(hasOptionalHostPermissions()).toBe(false);
      });
    });

    describe('ensureHostPermission', () => {
      beforeEach(() => {
        vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
          manifest_version: 3,
          name: 'Test',
          version: '1.0',
          optional_host_permissions: ['*://*/*'],
        });
      });

      it('returns false for empty origin', async () => {
        expect(await ensureHostPermission('')).toBe(false);
      });

      it('returns true when permission is already granted', async () => {
        vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(true);

        const result = await ensureHostPermission('https://example.com');

        expect(result).toBe(true);
        expect(fakeBrowser.permissions.contains).toHaveBeenCalledWith({
          origins: ['https://example.com/*'],
        });
      });

      it('requests permission when not granted', async () => {
        vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(false);
        vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(true);

        const result = await ensureHostPermission('https://example.com');

        expect(result).toBe(true);
        expect(fakeBrowser.permissions.request).toHaveBeenCalledWith({
          origins: ['https://example.com/*'],
        });
      });

      it('returns false when permission request is denied', async () => {
        vi.spyOn(fakeBrowser.permissions, 'contains').mockResolvedValue(false);
        vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(false);

        const result = await ensureHostPermission('https://example.com');

        expect(result).toBe(false);
      });
    });

    describe('getContentScriptFiles', () => {
      it('returns content script files from manifest', () => {
        vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
          manifest_version: 3,
          name: 'Test',
          version: '1.0',
          content_scripts: [
            { js: ['content.js'], matches: ['<all_urls>'] },
            { js: ['other.js'], matches: ['<all_urls>'] },
          ],
        });

        const files = getContentScriptFiles();

        expect(files).toEqual(['content.js', 'other.js']);
      });

      it('deduplicates content script files', () => {
        vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
          manifest_version: 3,
          name: 'Test',
          version: '1.0',
          content_scripts: [
            { js: ['content.js'], matches: ['<all_urls>'] },
            { js: ['content.js', 'other.js'], matches: ['<all_urls>'] },
          ],
        });

        const files = getContentScriptFiles();

        expect(files).toEqual(['content.js', 'other.js']);
      });

      it('returns fallback when no content scripts in manifest', () => {
        vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
          manifest_version: 3,
          name: 'Test',
          version: '1.0',
        });

        const files = getContentScriptFiles();

        expect(files).toEqual(['content-scripts/content.js']);
      });
    });
  });
});
