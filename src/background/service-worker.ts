// =============================================================================
// Background Service Worker
// =============================================================================

import type { Settings, MessageType } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message: MessageType, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Screenshot capture failed:', chrome.runtime.lastError.message);
        sendResponse({ type: 'SCREENSHOT_CAPTURED', data: '', error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ type: 'SCREENSHOT_CAPTURED', data: dataUrl });
      }
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'DOWNLOAD_FILE') {
    chrome.downloads.download(
      {
        url: message.dataUrl,
        filename: message.filename,
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError.message);
          sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (downloadId === undefined) {
          sendResponse({ ok: false, error: 'Download failed to start' });
          return;
        }
        sendResponse({ ok: true, downloadId });
      }
    );
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get settings:', chrome.runtime.lastError.message);
        sendResponse({ type: 'SETTINGS_RESPONSE', settings: DEFAULT_SETTINGS, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ type: 'SETTINGS_RESPONSE', settings: result as Settings });
    });
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.sync.set(message.settings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save settings:', chrome.runtime.lastError.message);
        sendResponse({ type: 'SETTINGS_RESPONSE', settings: message.settings, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ type: 'SETTINGS_RESPONSE', settings: message.settings });
    });
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    const count = message.count;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: '#3C82F7' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }

  return false;
});

// Initialize badge on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: '' });
});
