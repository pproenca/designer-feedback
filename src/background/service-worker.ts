// =============================================================================
// Background Service Worker
// =============================================================================

import type { Settings, MessageType } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';

// =============================================================================
// Tab Tracking for Same-Origin Persistence
// =============================================================================

const activatedTabs = new Map<number, string>(); // tabId -> origin

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

/**
 * Show toolbar on the given tab.
 * Content script is already injected via manifest's content_scripts.
 */
async function showToolbar(tabId: number): Promise<void> {
  try {
    // Tell content script to show toolbar
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOOLBAR' });
  } catch (error) {
    // Content script might not be ready yet, or page doesn't support it
    console.error('Failed to show toolbar:', error);
  }
}

// =============================================================================
// Icon Click Handler (1-Click Activation)
// =============================================================================

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  // Only inject on http/https pages
  if (!isInjectableUrl(tab.url)) {
    return;
  }

  // Track this tab for same-origin persistence
  activatedTabs.set(tab.id, getOrigin(tab.url));

  await showToolbar(tab.id);
});

// =============================================================================
// Same-Origin Navigation Persistence
// =============================================================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
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
  }
});

// Clean up on tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  activatedTabs.delete(tabId);
});

// =============================================================================
// Promise Wrappers for Chrome APIs
// =============================================================================

/**
 * Capture screenshot of the visible tab
 */
function captureScreenshot(windowId: number): Promise<{ data: string; error?: string }> {
  return new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot capture failed:', chrome.runtime.lastError.message);
        resolve({ data: '', error: chrome.runtime.lastError.message });
      } else {
        resolve({ data: dataUrl ?? '' });
      }
    });
  });
}

/**
 * Download a file from a data URL
 */
function downloadFile(
  dataUrl: string,
  filename: string
): Promise<{ ok: boolean; downloadId?: number; error?: string }> {
  return new Promise((resolve) => {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError.message);
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (downloadId === undefined) {
          resolve({ ok: false, error: 'Download failed to start' });
          return;
        }
        resolve({ ok: true, downloadId });
      }
    );
  });
}

/**
 * Get settings from sync storage
 */
function getSettings(): Promise<{ settings: Settings; error?: string }> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get settings:', chrome.runtime.lastError.message);
        resolve({ settings: DEFAULT_SETTINGS, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({ settings: result as Settings });
    });
  });
}

/**
 * Save settings to sync storage
 */
function saveSettings(settings: Settings): Promise<{ settings: Settings; error?: string }> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save settings:', chrome.runtime.lastError.message);
        resolve({ settings, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({ settings });
    });
  });
}

/**
 * Update the extension badge
 */
function updateBadge(count: number): void {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#3C82F7' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}


// =============================================================================
// Security
// =============================================================================

const isExtensionSender = (sender: chrome.runtime.MessageSender): boolean =>
  sender.id === chrome.runtime.id;

// =============================================================================
// Message Handler
// =============================================================================

chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  // Validate sender is from this extension
  if (!isExtensionSender(sender)) {
    return false;
  }

  // Handle screenshot capture
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    captureScreenshot(windowId)
      .then((result) => {
        sendResponse({ type: 'SCREENSHOT_CAPTURED', ...result });
      })
      .catch((error) => {
        sendResponse({ type: 'SCREENSHOT_CAPTURED', data: '', error: String(error) });
      });
    return true; // Keep message channel open for async response
  }

  // Handle file download
  if (message.type === 'DOWNLOAD_FILE') {
    downloadFile(message.dataUrl, message.filename)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({ ok: false, error: String(error) });
      });
    return true;
  }

  // Handle get settings
  if (message.type === 'GET_SETTINGS') {
    getSettings()
      .then((result) => {
        sendResponse({ type: 'SETTINGS_RESPONSE', ...result });
      })
      .catch((error) => {
        sendResponse({
          type: 'SETTINGS_RESPONSE',
          settings: DEFAULT_SETTINGS,
          error: String(error),
        });
      });
    return true;
  }

  // Handle save settings
  if (message.type === 'SAVE_SETTINGS') {
    saveSettings(message.settings)
      .then((result) => {
        sendResponse({ type: 'SETTINGS_RESPONSE', ...result });
      })
      .catch((error) => {
        sendResponse({
          type: 'SETTINGS_RESPONSE',
          settings: message.settings,
          error: String(error),
        });
      });
    return true;
  }

  // Handle badge update (synchronous)
  if (message.type === 'UPDATE_BADGE') {
    updateBadge(message.count);
    return false;
  }

  return false;
});

// Initialize badge on install
chrome.runtime.onInstalled.addListener(() => {
  updateBadge(0);
});
