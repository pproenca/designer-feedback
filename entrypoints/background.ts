// =============================================================================
// Background Service Worker
// =============================================================================

import { defineBackground } from 'wxt/sandbox';
import type { Settings, MessageType } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';

export default defineBackground(() => {
  // =============================================================================
  // Tab Tracking for Same-Origin Persistence
  // =============================================================================

  const activatedTabs = new Map<number, string>(); // tabId -> origin
  const ACTIVATED_TABS_KEY = 'designer-feedback:activated-tabs';

  function canUseSessionStorage(): boolean {
    return typeof browser !== 'undefined' && Boolean(browser.storage?.session);
  }

  function persistActivatedTabs(): void {
    if (!canUseSessionStorage()) return;
    const payload: Record<string, string> = {};
    activatedTabs.forEach((origin, tabId) => {
      payload[String(tabId)] = origin;
    });
    browser.storage.session.set({ [ACTIVATED_TABS_KEY]: payload }).catch((error) => {
      console.warn('Failed to persist activated tabs:', error);
    });
  }

  async function restoreActivatedTabs(): Promise<void> {
    if (!canUseSessionStorage()) return;
    try {
      const result = await browser.storage.session.get({ [ACTIVATED_TABS_KEY]: {} });
      const stored = result[ACTIVATED_TABS_KEY] as Record<string, string>;
      Object.entries(stored ?? {}).forEach(([tabId, origin]) => {
        const id = Number(tabId);
        if (Number.isFinite(id) && origin) {
          activatedTabs.set(id, origin);
        }
      });
      const tabs = await browser.tabs.query({});
      const validIds = new Set(tabs.map((tab) => tab.id).filter(Boolean) as number[]);
      let changed = false;
      for (const id of activatedTabs.keys()) {
        if (!validIds.has(id)) {
          activatedTabs.delete(id);
          changed = true;
        }
      }
      if (changed) {
        persistActivatedTabs();
      }
    } catch (error) {
      console.warn('Failed to restore activated tabs:', error);
    }
  }

  restoreActivatedTabs().catch((error) => {
    console.warn('Failed to restore activated tabs:', error);
  });

  /**
   * Check if a URL is injectable (http/https only)
   */
  function isInjectableUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * Get origin from URL
   */
  function getOrigin(url: string): string {
    try {
      return new URL(url).origin;
    } catch {
      return '';
    }
  }

  function getContentScriptFiles(): string[] {
    const manifest = browser.runtime.getManifest();
    const scripts = manifest.content_scripts ?? [];
    const files = scripts.flatMap((script) => script.js ?? []);
    const uniqueFiles = Array.from(new Set(files));
    if (uniqueFiles.length > 0) {
      return uniqueFiles;
    }
    // Fallback for programmatic-only injection (no manifest content_scripts)
    return ['content-scripts/content.js'];
  }

  async function injectContentScripts(tabId: number): Promise<boolean> {
    if (!browser.scripting?.executeScript) return false;
    const files = getContentScriptFiles();
    if (!files.length) return false;
    await browser.scripting.executeScript({ target: { tabId }, files });
    return true;
  }

  async function sendShowToolbar(tabId: number): Promise<void> {
    await browser.tabs.sendMessage(tabId, { type: 'SHOW_TOOLBAR' });
  }

  async function sendShowToolbarWithRetry(tabId: number): Promise<void> {
    try {
      await sendShowToolbar(tabId);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 60));
      await sendShowToolbar(tabId);
    }
  }

  /**
   * Show toolbar on the given tab.
   * Injects content scripts on-demand when needed.
   */
  async function showToolbar(tabId: number): Promise<void> {
    try {
      // Tell content script to show toolbar
      await sendShowToolbarWithRetry(tabId);
    } catch (error) {
      try {
        const injected = await injectContentScripts(tabId);
        if (injected) {
          await sendShowToolbarWithRetry(tabId);
          return;
        }
      } catch (retryError) {
        console.error('Failed to show toolbar after injection:', retryError);
        return;
      }
      // Content script might not be ready yet, or page doesn't support it
      console.error('Failed to show toolbar:', error);
    }
  }

  // =============================================================================
  // Icon Click Handler (1-Click Activation)
  // =============================================================================

  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !tab.url) return;

    // Only inject on http/https pages
    if (!isInjectableUrl(tab.url)) {
      return;
    }

    // Track this tab for same-origin persistence
    activatedTabs.set(tab.id, getOrigin(tab.url));
    persistActivatedTabs();

    await showToolbar(tab.id);
  });

  // =============================================================================
  // Same-Origin Navigation Persistence
  // =============================================================================

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;

    const previousOrigin = activatedTabs.get(tabId);
    if (!previousOrigin) return;

    const currentOrigin = getOrigin(tab.url);
    if (currentOrigin === previousOrigin) {
      // Same origin - re-inject
      showToolbar(tabId);
    } else {
      // Different origin - clear tracking
      activatedTabs.delete(tabId);
      persistActivatedTabs();
    }
  });

  // Clean up on tab close
  browser.tabs.onRemoved.addListener((tabId) => {
    activatedTabs.delete(tabId);
    persistActivatedTabs();
  });

  // =============================================================================
  // Promise Wrappers for Browser APIs
  // =============================================================================

  /**
   * Capture screenshot of the visible tab
   */
  async function captureScreenshot(windowId: number): Promise<{ data: string; error?: string }> {
    try {
      const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
      return { data: dataUrl ?? '' };
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return { data: '', error: String(error) };
    }
  }

  /**
   * Download a file from a data URL
   */
  async function downloadFile(
    dataUrl: string,
    filename: string
  ): Promise<{ ok: boolean; downloadId?: number; error?: string }> {
    try {
      const downloadId = await browser.downloads.download({
        url: dataUrl,
        filename,
        saveAs: false,
      });
      if (downloadId === undefined) {
        return { ok: false, error: 'Download failed to start' };
      }
      return { ok: true, downloadId };
    } catch (error) {
      console.error('Download failed:', error);
      return { ok: false, error: String(error) };
    }
  }

  /**
   * Get settings from sync storage
   */
  async function getSettings(): Promise<{ settings: Settings; error?: string }> {
    try {
      const result = await browser.storage.sync.get(DEFAULT_SETTINGS);
      return { settings: result as Settings };
    } catch (error) {
      console.error('Failed to get settings:', error);
      return { settings: DEFAULT_SETTINGS, error: String(error) };
    }
  }

  /**
   * Save settings to sync storage
   */
  async function saveSettings(settings: Settings): Promise<{ settings: Settings; error?: string }> {
    try {
      await browser.storage.sync.set(settings);
      return { settings };
    } catch (error) {
      console.error('Failed to save settings:', error);
      return { settings, error: String(error) };
    }
  }

  /**
   * Update the extension badge
   */
  function updateBadge(count: number): void {
    if (count > 0) {
      browser.action.setBadgeText({ text: String(count) });
      browser.action.setBadgeBackgroundColor({ color: '#3C82F7' });
    } else {
      browser.action.setBadgeText({ text: '' });
    }
  }

  // =============================================================================
  // Security
  // =============================================================================

  const isExtensionSender = (sender: { id?: string }): boolean =>
    sender.id === browser.runtime.id;

  // =============================================================================
  // Message Handler
  // =============================================================================

  browser.runtime.onMessage.addListener((message: unknown, sender: { id?: string; tab?: { windowId?: number } }) => {
    // Validate sender is from this extension
    if (!isExtensionSender(sender)) {
      return;
    }

    const msg = message as MessageType;

    // Handle screenshot capture
    if (msg.type === 'CAPTURE_SCREENSHOT') {
      const windowId = sender.tab?.windowId ?? browser.windows.WINDOW_ID_CURRENT;
      return captureScreenshot(windowId).then((result) => ({
        type: 'SCREENSHOT_CAPTURED',
        ...result,
      }));
    }

    // Handle screenshot permission status
    if (msg.type === 'CHECK_SCREENSHOT_PERMISSION') {
      if (!browser.permissions) {
        return Promise.resolve({
          type: 'SCREENSHOT_PERMISSION_STATUS',
          granted: false,
          error: 'Permissions API unavailable',
        });
      }
      const origin = msg.origin && msg.origin.trim().length > 0 ? msg.origin : '<all_urls>';
      return browser.permissions.contains({ origins: [origin] }).then((granted) => ({
        type: 'SCREENSHOT_PERMISSION_STATUS',
        granted: Boolean(granted),
      })).catch((error) => ({
        type: 'SCREENSHOT_PERMISSION_STATUS',
        granted: false,
        error: String(error),
      }));
    }

    // Handle screenshot permission request
    if (msg.type === 'REQUEST_SCREENSHOT_PERMISSION') {
      if (!browser.permissions) {
        return Promise.resolve({
          type: 'SCREENSHOT_PERMISSION_RESPONSE',
          granted: false,
          error: 'Permissions API unavailable',
        });
      }
      const origin = msg.origin && msg.origin.trim().length > 0 ? msg.origin : '<all_urls>';
      return browser.permissions.request({ origins: [origin] }).then((granted) => ({
        type: 'SCREENSHOT_PERMISSION_RESPONSE',
        granted: Boolean(granted),
      })).catch((error) => ({
        type: 'SCREENSHOT_PERMISSION_RESPONSE',
        granted: false,
        error: String(error),
      }));
    }

    // Handle file download
    if (msg.type === 'DOWNLOAD_FILE') {
      return downloadFile(msg.dataUrl, msg.filename);
    }

    // Handle get settings
    if (msg.type === 'GET_SETTINGS') {
      return getSettings().then((result) => ({
        type: 'SETTINGS_RESPONSE',
        ...result,
      }));
    }

    // Handle save settings
    if (msg.type === 'SAVE_SETTINGS') {
      return saveSettings(msg.settings).then((result) => ({
        type: 'SETTINGS_RESPONSE',
        ...result,
      }));
    }

    // Handle badge update (synchronous)
    if (msg.type === 'UPDATE_BADGE') {
      updateBadge(msg.count);
      return;
    }

    return;
  });

  // Initialize badge on install
  browser.runtime.onInstalled.addListener(() => {
    updateBadge(0);
  });
});
