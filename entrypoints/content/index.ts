import { defineContentScript } from 'wxt/sandbox';
import { getAnnotationCount, getStorageKey } from '@/utils/storage';
import { emitUiEvent } from '@/utils/ui-events';
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

    const messageHandler = async (message: unknown, _sender: unknown) => {
      void _sender;
      const msg = message as { type?: string };
      // Handle 1-click activation from service worker
      if (msg.type === 'SHOW_TOOLBAR') {
        try {
          await ensureInjected();
        } catch (error) {
          console.error('Failed to show toolbar:', error);
        }
        return;
      }

      if (msg.type === 'GET_ANNOTATION_COUNT') {
        const url = getStorageKey();
        try {
          const count = await getAnnotationCount(url);
          return { count };
        } catch {
          return { count: 0 };
        }
      }

      if (msg.type === 'TRIGGER_EXPORT') {
        try {
          await ensureInjected();
          window.setTimeout(() => {
            emitUiEvent('open-export');
          }, 0);
        } catch (error) {
          console.error('Failed to trigger export:', error);
        }
        return;
      }

      return;
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
