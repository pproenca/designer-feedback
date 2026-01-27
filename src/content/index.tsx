import { getAnnotationCount, getStorageKey } from '@/utils/storage';
import type { Settings } from '@/types';
import { mountUI, unmountUI } from './mount';

declare global {
  interface Window {
    __designerFeedbackInjected?: boolean;
  }
}

const isEligibleDocument =
  !!document.documentElement &&
  (document.contentType === 'text/html' || document.contentType === 'application/xhtml+xml');

if (isEligibleDocument && !window.__designerFeedbackInjected) {
  window.__designerFeedbackInjected = true;

  const DEFAULT_SETTINGS: Settings = {
    enabled: true,
    lightMode: false,
  };

  let isInjected = false;

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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_ANNOTATION_COUNT') {
      const url = getStorageKey();
      getAnnotationCount(url)
        .then((count) => sendResponse({ count }))
        .catch(() => sendResponse({ count: 0 }));
      return true;
    }

    if (message.type === 'TOGGLE_TOOLBAR' && message.enabled !== undefined) {
      if (message.enabled) {
        ensureInjected().catch((error) => {
          console.error('Failed to inject toolbar:', error);
        });
      } else {
        ensureUnmounted();
      }
      return false;
    }

    if (message.type === 'TRIGGER_EXPORT') {
      ensureInjected()
        .then(() => triggerExport())
        .catch((error) => {
          console.error('Failed to trigger export:', error);
        });
      return false;
    }

    return false;
  });

  chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to read settings:', chrome.runtime.lastError.message);
      return;
    }
    if ((result as Settings).enabled) {
      ensureInjected().catch((error) => {
        console.error('Failed to inject toolbar:', error);
      });
    }
  });
}
