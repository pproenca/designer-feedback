import { getAnnotationCount, getStorageKey } from '@/utils/storage';
import { mountUI } from './mount';

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

  let isInjected = false;

  // Message type for content script messages
  type ContentMessage = { type: string };

  // Store listener reference for cleanup (prevents memory leaks)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messageListener: ((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => boolean | void) | null = null;

  /**
   * Cleanup function to remove listener and prevent memory leaks
   */
  function cleanup(): void {
    if (messageListener) {
      chrome.runtime.onMessage.removeListener(messageListener);
      messageListener = null;
    }
  }

  async function ensureInjected(): Promise<void> {
    if (isInjected) return;
    await mountUI();
    isInjected = true;
  }

  // Create and store message listener reference
  messageListener = (message: ContentMessage, _sender, sendResponse) => {
    // Handle 1-click activation from service worker
    if (message.type === 'SHOW_TOOLBAR') {
      ensureInjected().catch((error) => {
        console.error('Failed to show toolbar:', error);
      });
      return false;
    }

    if (message.type === 'GET_ANNOTATION_COUNT') {
      const url = getStorageKey();
      getAnnotationCount(url)
        .then((count) => sendResponse({ count }))
        .catch(() => sendResponse({ count: 0 }));
      return true;
    }

    if (message.type === 'TRIGGER_EXPORT') {
      ensureInjected()
        .then(() => {
          window.setTimeout(() => {
            document.dispatchEvent(new CustomEvent('designer-feedback:open-export'));
          }, 0);
        })
        .catch((error) => {
          console.error('Failed to trigger export:', error);
        });
      return false;
    }

    return false;
  };
  chrome.runtime.onMessage.addListener(messageListener);

  // Clean up listener on page unload to prevent memory leaks
  window.addEventListener('beforeunload', cleanup);
}
