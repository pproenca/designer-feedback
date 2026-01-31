// =============================================================================
// Background Service Worker
// =============================================================================

import { defineBackground } from '#imports';
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
  persistActivatedTabs,
  restoreActivatedTabs,
  ensureHostPermission,
  getContentScriptFiles,
} from '@/utils/background-helpers';
import { activatedTabs as activatedTabsStorage } from '@/utils/storage-items';
import { backgroundMessenger, contentMessenger } from '@/utils/messaging';

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
    try {
      const stored = await activatedTabsStorage.getValue();
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
    await contentMessenger.sendMessage('showToolbar', undefined, tabId);
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
  // Message Handlers (using @webext-core/messaging)
  // =============================================================================

  backgroundMessenger.onMessage('captureScreenshot', async ({ sender }) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }
    try {
      const windowId = await getWindowIdForCapture(sender.tab?.windowId);
      const result = await captureVisibleTabScreenshot(windowId);
      return result;
    } catch (error) {
      console.error('[Background] captureScreenshot error:', error);
      return { data: '', error: String(error) };
    }
  });

  backgroundMessenger.onMessage('downloadFile', async ({ data, sender }) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }
    try {
      return await downloadFile(data.dataUrl, data.filename);
    } catch (error) {
      console.error('[Background] downloadFile error:', error);
      return { ok: false, error: String(error) };
    }
  });

  backgroundMessenger.onMessage('getSettings', async ({ sender }) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }
    try {
      return await getSettings();
    } catch (error) {
      return { settings: DEFAULT_SETTINGS, error: String(error) };
    }
  });

  backgroundMessenger.onMessage('saveSettings', async ({ data: settings, sender }) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }
    try {
      return await saveSettings(settings);
    } catch (error) {
      return { settings, error: String(error) };
    }
  });

  backgroundMessenger.onMessage('updateBadge', ({ data: count, sender }) => {
    if (!isExtensionSender(sender)) {
      return;
    }
    updateBadge(count);
  });

  // Initialize badge on install
  browser.runtime.onInstalled.addListener(() => {
    updateBadge(0);
  });
});
