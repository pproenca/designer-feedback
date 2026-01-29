import { defineContentScript } from 'wxt/sandbox';
import { getAnnotationCount, getStorageKey } from '@/utils/storage';
import { mountUI } from './mount';

declare global {
  interface Window {
    __designerFeedbackInjected?: boolean;
  }
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  registration: 'runtime',
  cssInjectionMode: 'ui',

  main(ctx) {
    console.log('[DF] Content script main() called');

    const isEligibleDocument =
      !!document.documentElement &&
      (document.contentType === 'text/html' || document.contentType === 'application/xhtml+xml');

    console.log('[DF] Document check:', {
      hasDocumentElement: !!document.documentElement,
      contentType: document.contentType,
      isEligible: isEligibleDocument,
      alreadyInjected: window.__designerFeedbackInjected,
    });

    if (!isEligibleDocument || window.__designerFeedbackInjected) {
      console.log('[DF] Skipping injection - not eligible or already injected');
      return;
    }

    window.__designerFeedbackInjected = true;
    console.log('[DF] Set __designerFeedbackInjected = true');

    let isInjected = false;

    async function ensureInjected(): Promise<void> {
      if (isInjected) return;
      await mountUI(ctx);
      isInjected = true;
    }

    const messageHandler = (
      message: unknown,
      _sender: unknown,
      sendResponse: (response?: unknown) => void
    ): boolean | void => {
      const msg = message as { type?: string };
      // Handle 1-click activation from service worker
      if (msg.type === 'SHOW_TOOLBAR') {
        ensureInjected().catch((error) => {
          console.error('Failed to show toolbar:', error);
        });
        return;
      }

      if (msg.type === 'GET_ANNOTATION_COUNT') {
        const url = getStorageKey();
        getAnnotationCount(url)
          .then((count) => sendResponse({ count }))
          .catch(() => sendResponse({ count: 0 }));
        return true; // Keep channel open for async response
      }

      if (msg.type === 'TRIGGER_EXPORT') {
        ensureInjected()
          .then(() => {
            window.setTimeout(() => {
              document.dispatchEvent(new CustomEvent('designer-feedback:open-export'));
            }, 0);
          })
          .catch((error) => {
            console.error('Failed to trigger export:', error);
          });
        return;
      }

      return;
    };

    // @ts-expect-error - WXT types are strict about message listener return type
    browser.runtime.onMessage.addListener(messageHandler);
  },
});
