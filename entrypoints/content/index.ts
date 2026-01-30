// CSS must be imported directly in the content script entry point
// for WXT's cssInjectionMode: 'ui' to work correctly
import './style.css';
import { defineContentScript } from '#imports';
import { getAnnotationCount, getStorageKey } from '@/utils/storage';
import { emitUiEvent } from '@/utils/ui-events';
import { mountUI } from './mount';
import { contentMessenger } from '@/utils/messaging';

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

    // Message handlers using @webext-core/messaging
    contentMessenger.onMessage('showToolbar', () => {
      ensureInjected().catch((error) => {
        console.error('Failed to show toolbar:', error);
      });
    });

    contentMessenger.onMessage('getAnnotationCount', async ({ data: url }) => {
      try {
        const targetUrl = url ?? getStorageKey();
        const count = await getAnnotationCount(targetUrl);
        return { count };
      } catch {
        return { count: 0 };
      }
    });

    contentMessenger.onMessage('triggerExport', () => {
      ensureInjected()
        .then(() => {
          window.setTimeout(() => {
            emitUiEvent('open-export');
          }, 0);
        })
        .catch((error) => {
          console.error('Failed to trigger export:', error);
        });
    });

    contentMessenger.onMessage('toggleToolbar', ({ data: enabled }) => {
      if (enabled) {
        ensureInjected().catch((error) => {
          console.error('Failed to toggle toolbar:', error);
        });
      }
    });

    ctx.onInvalidated(() => {
      // Note: @webext-core/messaging doesn't provide removeListener API
      // Listeners are cleaned up when the content script context is invalidated
      uiInstance?.remove();
      uiInstance = null;
      uiPromise = null;
      delete window.__designerFeedbackInjected;
    });
  },
});
