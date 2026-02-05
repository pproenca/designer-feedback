/**
 * Unit tests for background-helpers.ts
 * Tests critical paths: captureVisibleTabScreenshot, settings, badge, messaging guards
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import type {Settings} from '@/types';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {settingsEnabled, settingsLightMode} from '@/utils/storage-items';

import {
  // URL utilities
  isInjectableUrl,
  // Screenshot
  captureVisibleTabScreenshot,
  getWindowIdForCapture,
  getCaptureScreenshotErrorCode,
  // Settings
  getSettings,
  saveSettings,
  // Downloads
  downloadFile,
  // Badge
  updateBadge,
  // Security
  isExtensionSender,
  getContentScriptFiles,
} from './background-helpers';

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

      it('returns false for extension URLs', () => {
        expect(isInjectableUrl('chrome-extension://abc123/popup.html')).toBe(
          false
        );
        expect(isInjectableUrl('moz-extension://abc123/popup.html')).toBe(
          false
        );
      });

      it('returns false for about: URLs', () => {
        expect(isInjectableUrl('about:blank')).toBe(false);
        expect(isInjectableUrl('about:newtab')).toBe(false);
      });

      it('returns false for file:// URLs', () => {
        expect(isInjectableUrl('file:///path/to/file.html')).toBe(false);
      });
    });
  });

  // =============================================================================
  // Screenshot Capture
  // =============================================================================

  describe('captureVisibleTabScreenshot', () => {
    it('returns data URL on success', async () => {
      const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
      vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockResolvedValue(
        testDataUrl
      );

      const result = await captureVisibleTabScreenshot(1);

      expect(result.data).toBe(testDataUrl);
      expect(result.error).toBeUndefined();
    });

    it('returns error when captureVisibleTab fails', async () => {
      vi.spyOn(fakeBrowser.tabs, 'captureVisibleTab').mockRejectedValue(
        new Error('Tab capture failed')
      );
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await captureVisibleTabScreenshot(1);

      expect(result.data).toBe('');
      expect(result.error).toContain('Tab capture failed');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Background] captureVisibleTab failed:',
        expect.any(Error)
      );
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

      expect(captureVisibleTabSpy).toHaveBeenCalledWith(42, {format: 'png'});
    });
  });

  describe('getWindowIdForCapture', () => {
    it('returns sender.tab.windowId when provided', async () => {
      const windowId = await getWindowIdForCapture(42);
      expect(windowId).toBe(42);
    });

    it('returns WINDOW_ID_CURRENT when sender.tab.windowId is undefined', async () => {
      const windowId = await getWindowIdForCapture(undefined);
      expect(windowId).toBe(fakeBrowser.windows.WINDOW_ID_CURRENT);
    });
  });

  describe('getCaptureScreenshotErrorCode', () => {
    it('detects activeTab permission failures for Chrome and Firefox messages', () => {
      expect(
        getCaptureScreenshotErrorCode(
          'Error: Either the "<all_urls>" or "activeTab" permission is required.'
        )
      ).toBe('activeTab-required');
      expect(
        getCaptureScreenshotErrorCode(
          'Error: Missing host permission for the tab'
        )
      ).toBe('activeTab-required');
      expect(
        getCaptureScreenshotErrorCode(
          'Error: Cannot access contents of the page.'
        )
      ).toBe('activeTab-required');
    });

    it('detects rate limiting separately from permission failures', () => {
      expect(
        getCaptureScreenshotErrorCode(
          'Error: MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND quota exceeded'
        )
      ).toBe('capture-rate-limited');
      expect(
        getCaptureScreenshotErrorCode(
          'Too many calls to tabs.captureVisibleTab'
        )
      ).toBe('capture-rate-limited');
    });

    it('returns undefined for unrelated errors', () => {
      expect(getCaptureScreenshotErrorCode('Unexpected capture error')).toBe(
        undefined
      );
      expect(getCaptureScreenshotErrorCode(undefined)).toBe(undefined);
    });
  });

  // =============================================================================
  // Downloads
  // =============================================================================

  describe('downloadFile', () => {
    it('uses a blob URL when createObjectURL is available', async () => {
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      const createSpy = vi.fn().mockReturnValue('blob:mock');
      const revokeSpy = vi.fn();
      Object.defineProperty(URL, 'createObjectURL', {
        value: createSpy,
        configurable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: revokeSpy,
        configurable: true,
      });

      const downloadSpy = vi
        .spyOn(fakeBrowser.downloads, 'download')
        .mockResolvedValue(101);

      vi.useFakeTimers();
      const result = await downloadFile(
        'data:text/plain;base64,SGVsbG8=',
        'test.txt'
      );

      expect(downloadSpy).toHaveBeenCalledWith({
        url: 'blob:mock',
        filename: 'test.txt',
        saveAs: false,
      });
      expect(result.ok).toBe(true);

      vi.runAllTimers();
      expect(revokeSpy).toHaveBeenCalledWith('blob:mock');

      vi.useRealTimers();
      Object.defineProperty(URL, 'createObjectURL', {
        value: originalCreate,
        configurable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: originalRevoke,
        configurable: true,
      });
    });

    it('falls back to data URL when createObjectURL is unavailable', async () => {
      const originalCreate = URL.createObjectURL;
      Object.defineProperty(URL, 'createObjectURL', {
        value: undefined,
        configurable: true,
      });

      const downloadSpy = vi
        .spyOn(fakeBrowser.downloads, 'download')
        .mockResolvedValue(202);

      const dataUrl = 'data:text/plain;base64,SGVsbG8=';
      const result = await downloadFile(dataUrl, 'test.txt');

      expect(downloadSpy).toHaveBeenCalledWith({
        url: dataUrl,
        filename: 'test.txt',
        saveAs: false,
      });
      expect(result.ok).toBe(true);

      Object.defineProperty(URL, 'createObjectURL', {
        value: originalCreate,
        configurable: true,
      });
    });
  });

  // =============================================================================
  // Settings Management
  // =============================================================================

  describe('Settings Management', () => {
    describe('getSettings', () => {
      it('returns settings from sync storage', async () => {
        const customSettings: Settings = {enabled: false, lightMode: false};
        await settingsEnabled.setValue(customSettings.enabled);
        await settingsLightMode.setValue(customSettings.lightMode);

        const result = await getSettings();

        expect(result.settings).toEqual(customSettings);
        expect(result.error).toBeUndefined();
      });

      it('returns default settings when storage fails', async () => {
        vi.spyOn(settingsEnabled, 'getValue').mockRejectedValue(
          new Error('Storage error')
        );
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        const result = await getSettings();

        expect(result.settings).toEqual(DEFAULT_SETTINGS);
        expect(result.error).toContain('Storage error');
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to get settings:',
          expect.any(Error)
        );
        consoleSpy.mockRestore();
      });
    });

    describe('saveSettings', () => {
      it('saves settings to sync storage', async () => {
        const newSettings: Settings = {enabled: false, lightMode: true};
        const enabledSpy = vi
          .spyOn(settingsEnabled, 'setValue')
          .mockResolvedValue(undefined);
        const lightModeSpy = vi
          .spyOn(settingsLightMode, 'setValue')
          .mockResolvedValue(undefined);

        const result = await saveSettings(newSettings);

        expect(enabledSpy).toHaveBeenCalledWith(false);
        expect(lightModeSpy).toHaveBeenCalledWith(true);
        expect(result.settings).toEqual(newSettings);
        expect(result.error).toBeUndefined();
      });

      it('returns error when saving fails', async () => {
        vi.spyOn(settingsEnabled, 'setValue').mockRejectedValue(
          new Error('Quota exceeded')
        );
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        const result = await saveSettings(DEFAULT_SETTINGS);

        expect(result.settings).toEqual(DEFAULT_SETTINGS);
        expect(result.error).toContain('Quota exceeded');
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to save settings:',
          expect.any(Error)
        );
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
      vi.spyOn(fakeBrowser.action, 'setBadgeBackgroundColor').mockResolvedValue(
        undefined
      );

      updateBadge(5);

      expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({text: '5'});
      expect(fakeBrowser.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#3C82F7',
      });
    });

    it('clears badge text for zero count', () => {
      vi.spyOn(fakeBrowser.action, 'setBadgeText').mockResolvedValue(undefined);
      vi.spyOn(fakeBrowser.action, 'setBadgeBackgroundColor').mockResolvedValue(
        undefined
      );

      updateBadge(0);

      expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({text: ''});
      // setBadgeBackgroundColor should NOT be called for zero count
      expect(fakeBrowser.action.setBadgeBackgroundColor).not.toHaveBeenCalled();
    });

    it('handles large counts', () => {
      vi.spyOn(fakeBrowser.action, 'setBadgeText').mockResolvedValue(undefined);
      vi.spyOn(fakeBrowser.action, 'setBadgeBackgroundColor').mockResolvedValue(
        undefined
      );

      updateBadge(999);

      expect(fakeBrowser.action.setBadgeText).toHaveBeenCalledWith({
        text: '999',
      });
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

        expect(isExtensionSender({id: extensionId})).toBe(true);
      });

      it('returns false for non-matching extension ID', () => {
        Object.defineProperty(fakeBrowser.runtime, 'id', {
          value: 'my-extension-id',
          configurable: true,
        });

        expect(isExtensionSender({id: 'malicious-extension'})).toBe(false);
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

  describe('getContentScriptFiles', () => {
    it('returns content script files from manifest', () => {
      vi.spyOn(fakeBrowser.runtime, 'getManifest').mockReturnValue({
        manifest_version: 3,
        name: 'Test',
        version: '1.0',
        content_scripts: [
          {js: ['content.js'], matches: ['<all_urls>']},
          {js: ['other.js'], matches: ['<all_urls>']},
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
          {js: ['content.js'], matches: ['<all_urls>']},
          {js: ['content.js', 'other.js'], matches: ['<all_urls>']},
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
