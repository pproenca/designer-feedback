// =============================================================================
// Background Service Worker
// =============================================================================

import type { Settings, MessageType } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { isUrlAllowed } from '@/utils/site-access';
import { getOriginPattern } from '@/utils/permissions';

const CONTENT_SCRIPT_FILE = 'assets/content-loader.js';

let cachedSettings: Settings = DEFAULT_SETTINGS;
let settingsReady = false;

const loadSettings = async (): Promise<Settings> => {
  if (settingsReady) return cachedSettings;
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to load settings:', chrome.runtime.lastError.message);
        cachedSettings = DEFAULT_SETTINGS;
        settingsReady = true;
        resolve(cachedSettings);
        return;
      }
      cachedSettings = result as Settings;
      settingsReady = true;
      resolve(cachedSettings);
    });
  });
};

const updateSettingsCache = (changes: { [key: string]: chrome.storage.StorageChange }) => {
  const nextSettings = { ...cachedSettings };
  let hasChange = false;

  if (changes.enabled) {
    nextSettings.enabled = Boolean(changes.enabled.newValue);
    hasChange = true;
  }
  if (changes.lightMode) {
    nextSettings.lightMode = Boolean(changes.lightMode.newValue);
    hasChange = true;
  }
  if (changes.siteListMode) {
    nextSettings.siteListMode = changes.siteListMode.newValue as Settings['siteListMode'];
    hasChange = true;
  }
  if (changes.siteList) {
    nextSettings.siteList = (changes.siteList.newValue as Settings['siteList']) ?? [];
    hasChange = true;
  }

  if (hasChange) {
    cachedSettings = nextSettings;
    settingsReady = true;
  }
};

const hasHostPermission = async (url: string): Promise<boolean> => {
  const originPattern = getOriginPattern(url);
  if (!originPattern) return false;

  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: [originPattern] }, (granted) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(Boolean(granted));
    });
  });
};

const markInjectionIfNeeded = async (tabId: number): Promise<boolean> =>
  new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => {
          const windowAny = window as Window & {
            __designerFeedbackInjected?: boolean;
            __designerFeedbackLoaderInjected?: boolean;
          };
          if (windowAny.__designerFeedbackInjected || windowAny.__designerFeedbackLoaderInjected) {
            return false;
          }
          windowAny.__designerFeedbackLoaderInjected = true;
          return true;
        },
      },
      (results) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(Boolean(results?.[0]?.result));
      }
    );
  });

const maybeInjectToolbar = async (tabId: number, url?: string) => {
  if (!url) return;
  const settings = await loadSettings();
  if (!settings.enabled) return;
  if (!isUrlAllowed(url, settings)) return;
  const permitted = await hasHostPermission(url);
  if (!permitted) return;
  const shouldInject = await markInjectionIfNeeded(tabId);
  if (!shouldInject) return;

  chrome.scripting.executeScript(
    {
      target: { tabId },
      files: [CONTENT_SCRIPT_FILE],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.debug('Toolbar injection skipped:', chrome.runtime.lastError.message);
      }
    }
  );
};

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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  void maybeInjectToolbar(tabId, tab.url);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  updateSettingsCache(changes);
});
