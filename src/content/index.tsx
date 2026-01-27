import { getAnnotationCount, getStorageKey } from '@/utils/storage';
import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { isUrlAllowed } from '@/utils/site-access';
import { mountUI, unmountUI } from './mount';

declare global {
  interface Window {
    __designerFeedbackInjected?: boolean;
    __designerFeedbackLoaderInjected?: boolean;
  }
}

const isEligibleDocument =
  !!document.documentElement &&
  (document.contentType === 'text/html' || document.contentType === 'application/xhtml+xml');

if (isEligibleDocument && !window.__designerFeedbackInjected) {
  window.__designerFeedbackInjected = true;

  let isInjected = false;
  let currentSettings: Settings = DEFAULT_SETTINGS;

  async function ensureInjected(): Promise<void> {
    if (isInjected) return;
    await mountUI();
    isInjected = true;
  }

  function ensureUnmounted(): void {
    if (!isInjected) return;
    unmountUI();
    isInjected = false;
  }

  function triggerExport(): void {
    // Allow time for the UI to mount and register listeners.
    window.setTimeout(() => {
      document.dispatchEvent(new CustomEvent('designer-feedback:open-export'));
    }, 0);
  }

  const shouldRunOnPage = () =>
    currentSettings.enabled &&
    isUrlAllowed(window.location.href, {
      siteListMode: currentSettings.siteListMode,
      siteList: currentSettings.siteList,
    });

  const applySettings = async () => {
    if (shouldRunOnPage()) {
      await ensureInjected();
    } else {
      ensureUnmounted();
    }
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_ANNOTATION_COUNT') {
      if (!shouldRunOnPage()) {
        sendResponse({ count: 0 });
        return true;
      }
      const url = getStorageKey();
      getAnnotationCount(url)
        .then((count) => sendResponse({ count }))
        .catch(() => sendResponse({ count: 0 }));
      return true;
    }

    if (message.type === 'TOGGLE_TOOLBAR' && message.enabled !== undefined) {
      currentSettings = { ...currentSettings, enabled: message.enabled };
      applySettings().catch((error) => {
        console.error('Failed to apply settings:', error);
      });
      return false;
    }

    if (message.type === 'TRIGGER_EXPORT') {
      if (shouldRunOnPage()) {
        ensureInjected()
          .then(() => triggerExport())
          .catch((error) => {
            console.error('Failed to trigger export:', error);
          });
      }
      return false;
    }

    return false;
  });

  chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to read settings:', chrome.runtime.lastError.message);
      return;
    }
    currentSettings = result as Settings;
    applySettings().catch((error) => {
      console.error('Failed to apply settings:', error);
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    const nextSettings: Settings = { ...currentSettings };
    let hasRelevantChange = false;

    if (changes.enabled) {
      nextSettings.enabled = Boolean(changes.enabled.newValue);
      hasRelevantChange = true;
    }

    if (changes.lightMode) {
      nextSettings.lightMode = Boolean(changes.lightMode.newValue);
      hasRelevantChange = true;
    }

    if (changes.siteListMode) {
      nextSettings.siteListMode = changes.siteListMode
        .newValue as Settings['siteListMode'];
      hasRelevantChange = true;
    }

    if (changes.siteList) {
      nextSettings.siteList = (changes.siteList.newValue as Settings['siteList']) ?? [];
      hasRelevantChange = true;
    }

    if (hasRelevantChange) {
      currentSettings = nextSettings;
      applySettings().catch((error) => {
        console.error('Failed to apply settings:', error);
      });
    }
  });
}
