// =============================================================================
// Background Service Worker
// =============================================================================

import { defineBackground } from '#imports';
import type { Settings, MessageType } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { hashString } from '@/utils/hash';
import {
  OFFSCREEN_DOCUMENT_PATH,
  MESSAGE_TARGET,
  OFFSCREEN_MESSAGE_TYPE,
} from '@/utils/offscreen-constants';

export default defineBackground(() => {
  // =============================================================================
  // Tab Tracking for Same-Origin Persistence
  // =============================================================================

  const activatedTabs = new Map<number, string>(); // tabId -> origin hash
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

  function normalizeOriginHash(value: string): string {
    if (value.includes('://')) {
      return hashString(value);
    }
    return value;
  }

  async function restoreActivatedTabs(): Promise<void> {
    if (!canUseSessionStorage()) return;
    try {
      const result = await browser.storage.session.get({ [ACTIVATED_TABS_KEY]: {} });
      const stored = result[ACTIVATED_TABS_KEY] as Record<string, string>;
      let changed = false;
      Object.entries(stored ?? {}).forEach(([tabId, origin]) => {
        const id = Number(tabId);
        if (Number.isFinite(id) && origin) {
          const normalized = normalizeOriginHash(origin);
          if (normalized !== origin) {
            changed = true;
          }
          activatedTabs.set(id, normalized);
        }
      });
      const tabs = await browser.tabs.query({});
      const validIds = new Set(tabs.map((tab) => tab.id).filter(Boolean) as number[]);
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

  function getOriginHash(origin: string): string {
    return hashString(origin);
  }

  function getOriginPattern(origin: string): string {
    return `${origin}/*`;
  }

  function hasOptionalHostPermissions(): boolean {
    try {
      const manifest = browser.runtime.getManifest() as { optional_host_permissions?: string[] };
      const optional = manifest.optional_host_permissions;
      return Array.isArray(optional) && optional.length > 0;
    } catch {
      return false;
    }
  }

  async function ensureHostPermission(origin: string): Promise<boolean> {
    if (!origin) return false;
    if (!hasOptionalHostPermissions()) return false;
    if (!browser.permissions?.contains || !browser.permissions?.request) return false;

    const pattern = getOriginPattern(origin);
    try {
      const granted = await browser.permissions.contains({ origins: [pattern] });
      if (granted) return true;
    } catch {
      // continue to request
    }

    try {
      const granted = await browser.permissions.request({ origins: [pattern] });
      return Boolean(granted);
    } catch {
      return false;
    }
  }

  async function getActivatedOriginHash(tabId: number): Promise<string | null> {
    const cached = activatedTabs.get(tabId);
    if (cached) return cached;
    if (!canUseSessionStorage()) return null;
    try {
      const result = await browser.storage.session.get({ [ACTIVATED_TABS_KEY]: {} });
      const stored = result[ACTIVATED_TABS_KEY] as Record<string, string>;
      const origin = stored?.[String(tabId)];
      if (origin) {
        const normalized = normalizeOriginHash(origin);
        activatedTabs.set(tabId, normalized);
        return normalized;
      }
    } catch (error) {
      console.warn('Failed to read activated tab origin:', error);
    }
    return null;
  }

  function setActivatedTab(tabId: number, originHash: string): void {
    activatedTabs.set(tabId, originHash);
    persistActivatedTabs();
  }

  function clearActivatedTab(tabId: number): void {
    activatedTabs.delete(tabId);
    persistActivatedTabs();
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
  async function showToolbar(tabId: number): Promise<boolean> {
    try {
      // Tell content script to show toolbar
      await sendShowToolbarWithRetry(tabId);
      return true;
    } catch (error) {
      try {
        const injected = await injectContentScripts(tabId);
        if (injected) {
          await sendShowToolbarWithRetry(tabId);
          return true;
        }
      } catch (retryError) {
        console.error('Failed to show toolbar after injection:', retryError);
        return false;
      }
      // Content script might not be ready yet, or page doesn't support it
      console.error('Failed to show toolbar:', error);
    }
    return false;
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

    const origin = getOrigin(tab.url);
    const originHash = getOriginHash(origin);
    const canPersist = await ensureHostPermission(origin);
    const shown = await showToolbar(tab.id);
    if (shown && canPersist) {
      setActivatedTab(tab.id, originHash);
    } else {
      clearActivatedTab(tab.id);
    }
  });

  // =============================================================================
  // Same-Origin Navigation Persistence
  // =============================================================================

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    const url = tab.url;
    void (async () => {
      const previousOriginHash = await getActivatedOriginHash(tabId);
      if (!previousOriginHash) return;

      const currentOrigin = getOrigin(url);
      const currentOriginHash = getOriginHash(currentOrigin);
      if (currentOriginHash === previousOriginHash) {
        // Same origin - re-inject
        const shown = await showToolbar(tabId);
        if (!shown) {
          clearActivatedTab(tabId);
        }
      } else {
        // Different origin - clear tracking
        clearActivatedTab(tabId);
      }
    })();
  });

  // Clean up on tab close
  browser.tabs.onRemoved.addListener((tabId) => {
    clearActivatedTab(tabId);
  });

  // =============================================================================
  // Promise Wrappers for Browser APIs
  // =============================================================================

  /**
   * Capture screenshot of the visible tab
   */
  async function captureScreenshot(windowId: number): Promise<{ data: string; error?: string }> {
    console.log('[Background] captureScreenshot called with windowId:', windowId);
    try {
      const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
      console.log('[Background] captureVisibleTab result:', {
        hasData: !!dataUrl,
        length: dataUrl?.length ?? 0,
      });
      if (!dataUrl) {
        return { data: '', error: 'captureVisibleTab returned empty' };
      }
      return { data: dataUrl };
    } catch (error) {
      console.error('[Background] captureVisibleTab failed:', error);
      return { data: '', error: String(error) };
    }
  }

  // =============================================================================
  // Offscreen Document Management
  // =============================================================================

  /**
   * Check if an offscreen document already exists
   * Uses getContexts API with fallback for older Chrome versions
   */
  async function hasOffscreenDocument(): Promise<boolean> {
    try {
      // Use browser.runtime.getContexts to check for existing offscreen document
      const existingContexts = await browser.runtime.getContexts({
        contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
      });
      return existingContexts.length > 0;
    } catch {
      // Fallback for older Chrome versions that don't support getContexts
      // This can happen in Chrome < 116
      return false;
    }
  }

  /**
   * Ensure offscreen document exists for blob URL creation
   */
  async function setupOffscreenDocument(): Promise<void> {
    console.log('[Background] setupOffscreenDocument called');

    // Check if offscreen document already exists
    const exists = await hasOffscreenDocument();
    console.log('[Background] Offscreen document exists:', exists);

    if (exists) {
      return;
    }

    // Create offscreen document for blob URL creation
    console.log('[Background] Creating offscreen document...');
    await browser.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [browser.offscreen.Reason.BLOBS],
      justification: 'Convert data URL to blob URL for downloading screenshots',
    });
    // Small delay to ensure script is loaded
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.log('[Background] Offscreen document created and ready');
  }

  /**
   * Download a file from a data URL using offscreen document for blob conversion
   */
  async function downloadFile(
    dataUrl: string,
    filename: string
  ): Promise<{ ok: boolean; downloadId?: number; error?: string }> {
    console.log('[Background] downloadFile called', { filename, dataUrlLength: dataUrl.length });
    try {
      // Create offscreen document for blob URL creation
      await setupOffscreenDocument();

      // Send data URL to offscreen document for conversion to blob URL
      console.log('[Background] Sending OFFSCREEN_DOWNLOAD message...');
      const response = (await browser.runtime.sendMessage({
        type: OFFSCREEN_MESSAGE_TYPE.DOWNLOAD,
        target: MESSAGE_TARGET.OFFSCREEN,
        dataUrl,
      })) as { ok: boolean; blobUrl?: string; error?: string } | undefined;
      console.log('[Background] OFFSCREEN_DOWNLOAD response:', JSON.stringify(response));

      if (!response?.ok || !response?.blobUrl) {
        return { ok: false, error: response?.error ?? 'Blob conversion failed' };
      }

      // Download using blob URL (from offscreen document context)
      console.log('[Background] Starting download with blob URL...');
      const downloadId = await browser.downloads.download({
        url: response.blobUrl,
        filename,
        saveAs: false,
      });
      console.log('[Background] Download started, id:', downloadId);

      if (downloadId === undefined) {
        return { ok: false, error: 'Download failed to start' };
      }

      return { ok: true, downloadId };
    } catch (error) {
      console.error('[Background] Download failed:', error);
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
    const msg = message as MessageType;
    console.log('[Background] Received message:', msg.type, 'from sender:', sender.id);

    // Validate sender is from this extension
    if (!isExtensionSender(sender)) {
      console.log('[Background] Rejecting message from non-extension sender');
      return;
    }

    // Handle screenshot capture
    if (msg.type === 'CAPTURE_SCREENSHOT') {
      const windowId = sender.tab?.windowId ?? browser.windows.WINDOW_ID_CURRENT;
      console.log('[Background] Handling CAPTURE_SCREENSHOT for windowId:', windowId);
      return captureScreenshot(windowId).then((result) => {
        console.log('[Background] captureScreenshot result:', JSON.stringify({ hasData: !!result.data, error: result.error }));
        return {
          type: 'SCREENSHOT_CAPTURED',
          ...result,
        };
      });
    }

    // Handle file download
    if (msg.type === 'DOWNLOAD_FILE') {
      console.log('[Background] Handling DOWNLOAD_FILE');
      return downloadFile(msg.dataUrl, msg.filename).catch((error) => {
        console.error('[Background] downloadFile error:', error);
        return { ok: false, error: String(error) };
      });
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
