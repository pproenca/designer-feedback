// CSS must be imported directly in the content script entry point
// for WXT's cssInjectionMode: 'ui' to work correctly
import './style.css';
import { defineContentScript } from '#imports';
import { getAnnotationCount, getStorageKey } from '@/utils/storage';
import { emitUiEvent } from '@/utils/ui-events';
import { mountUI } from './mount';

declare global {
  interface Window {
    __designerFeedbackInjected?: boolean;
  }
}

export default defineContentScript({
  matches: [], // Empty - prevents WXT from adding host_permissions; injection via scripting.executeScript() + activeTab
  registration: 'runtime',
  world: 'ISOLATED',
  cssInjectionMode: 'ui',

  main(ctx) {
    const isEligibleDocument =
      !!document.documentElement &&
      (document.contentType === 'text/html' || document.contentType === 'application/xhtml+xml');

    if (!isEligibleDocument || window.__designerFeedbackInjected) {
      return;
    }

    window.__designerFeedbackInjected = true;

    let uiPromise: Promise<Awaited<ReturnType<typeof mountUI>>> | null = null;
    let uiInstance: Awaited<ReturnType<typeof mountUI>> | null = null;

    async function ensureInjected(): Promise<void> {
      if (uiInstance) return;
      if (!uiPromise) {
        uiPromise = mountUI(ctx)
          .then((ui) => {
            uiInstance = ui;
            return ui;
          })
          .catch((error) => {
            uiPromise = null;
            uiInstance = null;
            window.__designerFeedbackInjected = false;
            throw error;
          });
      }
      await uiPromise;
    }

    // Message handler - must return true for async responses, false/undefined for unhandled
    // Using synchronous function to properly handle messaging protocol
    type MessageSender = { tab?: { id?: number }; frameId?: number; id?: string };
    const messageHandler = (
      message: unknown,
      _sender: MessageSender,
      sendResponse: (response?: unknown) => void
    ): boolean | void => {
      const msg = message as { type?: string };

      // Only handle messages meant for content script
      // Return nothing for unhandled messages so other listeners (offscreen doc) can respond
      if (msg.type === 'SHOW_TOOLBAR') {
        ensureInjected().catch((error) => {
          console.error('Failed to show toolbar:', error);
        });
        return; // No response needed, don't keep channel open
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
              emitUiEvent('open-export');
            }, 0);
          })
          .catch((error) => {
            console.error('Failed to trigger export:', error);
          });
        return; // No response needed
      }

      // Don't return anything for messages we don't handle
      // This allows other listeners (like offscreen document) to respond
    };

    browser.runtime.onMessage.addListener(messageHandler);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(messageHandler);
      uiInstance?.remove();
      uiInstance = null;
      uiPromise = null;
      delete window.__designerFeedbackInjected;
    });
  },
});
