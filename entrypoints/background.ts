// =============================================================================
// Background Service Worker
// =============================================================================

import { defineBackground } from '#imports';
import type { MessageType, Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import {
  // URL utilities
  isInjectableUrl,
  getOrigin,
  getOriginHash,
  normalizeOriginHash,
  // Screenshot
  captureVisibleTabScreenshot,
  getWindowIdForCapture,
  // Download
  downloadFile,
  // Settings
  getSettings,
  saveSettings,
  // Badge
  updateBadge,
  // Security
  isExtensionSender,
  // Tab tracking
  ACTIVATED_TABS_KEY,
  canUseSessionStorage,
  persistActivatedTabs,
  restoreActivatedTabs,
  ensureHostPermission,
  getContentScriptFiles,
} from '@/utils/background-helpers';

export default defineBackground(() => {
  // =============================================================================
  // Tab Tracking State (scoped to service worker lifecycle)
  // =============================================================================

  const activatedTabs = new Map<number, string>(); // tabId -> origin hash

  // Restore activated tabs on service worker startup
  restoreActivatedTabs(activatedTabs)
    .then((changed) => {
      if (changed) {
        persistActivatedTabs(activatedTabs);
      }
    })
    .catch((error) => {
      console.warn('Failed to restore activated tabs:', error);
    });

  // =============================================================================
  // Tab Tracking Helpers (use shared state)
  // =============================================================================

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
    persistActivatedTabs(activatedTabs);
  }

  function clearActivatedTab(tabId: number): void {
    activatedTabs.delete(tabId);
    persistActivatedTabs(activatedTabs);
  }

  // =============================================================================
  // Content Script Injection
  // =============================================================================

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
  // Message Handler
  // =============================================================================

  browser.runtime.onMessage.addListener((
    message: unknown,
    sender: { id?: string; tab?: { windowId?: number; id?: number; url?: string } },
    sendResponse: (response?: unknown) => void
  ) => {
    const msg = message as MessageType & { target?: string; settings?: Settings };
    console.log('[Background] Received message:', msg.type);
    console.log('[Background] sender.tab:', JSON.stringify(sender.tab));
    console.log('[Background] sender.tab?.windowId:', sender.tab?.windowId);
    console.log('[Background] sender.tab?.id:', sender.tab?.id);
    console.log('[Background] sender.tab?.url:', sender.tab?.url);

    // Validate sender is from this extension
    if (!isExtensionSender(sender)) {
      console.log('[Background] Rejecting message from non-extension sender');
      return;
    }

    // Skip messages targeted at other contexts (e.g., offscreen document)
    // Return false to allow other listeners to handle the message
    if (msg.target && msg.target !== 'background') {
      return false;
    }

    // Handle screenshot capture
    if (msg.type === 'CAPTURE_SCREENSHOT') {
      console.log('[Background] Handling CAPTURE_SCREENSHOT');
      getWindowIdForCapture(sender.tab?.windowId)
        .then((windowId) => {
          console.log('[Background] Using windowId for capture:', windowId);
          return captureVisibleTabScreenshot(windowId);
        })
        .then((result) => {
          console.log('[Background] captureScreenshot result:', JSON.stringify({ hasData: !!result.data, error: result.error }));
          sendResponse({ type: 'SCREENSHOT_CAPTURED', ...result });
        })
        .catch((error) => {
          console.error('[Background] captureScreenshot error:', error);
          sendResponse({ type: 'SCREENSHOT_CAPTURED', data: '', error: String(error) });
        });
      return true; // Keep message channel open for async response
    }

    // Handle file download
    if (msg.type === 'DOWNLOAD_FILE') {
      console.log('[Background] Handling DOWNLOAD_FILE');
      downloadFile(msg.dataUrl, msg.filename)
        .then((result) => sendResponse(result))
        .catch((error) => {
          console.error('[Background] downloadFile error:', error);
          sendResponse({ ok: false, error: String(error) });
        });
      return true; // Keep message channel open for async response
    }

    // Handle get settings
    if (msg.type === 'GET_SETTINGS') {
      getSettings()
        .then((result) => sendResponse({ type: 'SETTINGS_RESPONSE', ...result }))
        .catch((error) => sendResponse({ type: 'SETTINGS_RESPONSE', settings: DEFAULT_SETTINGS, error: String(error) }));
      return true; // Keep message channel open for async response
    }

    // Handle save settings
    if (msg.type === 'SAVE_SETTINGS') {
      saveSettings(msg.settings as Settings)
        .then((result) => sendResponse({ type: 'SETTINGS_RESPONSE', ...result }))
        .catch((error) => sendResponse({ type: 'SETTINGS_RESPONSE', settings: msg.settings, error: String(error) }));
      return true; // Keep message channel open for async response
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
