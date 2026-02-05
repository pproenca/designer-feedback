import './style.css';
import {defineContentScript} from '#imports';
import {getAnnotationCount, getStorageKey} from '@/utils/storage';
import {emitUiEvent} from '@/utils/ui-events';
import {mountUI} from './mount';
import {
  contentMessenger,
  type ResumeExportRequest,
  type ResumeExportResponse,
} from '@/utils/messaging';
import {enqueueResumeExportRequest} from '@/utils/resume-export-queue';
import {createToolbarLifecycle} from './toolbar-lifecycle';

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
  allFrames: false,

  main(ctx) {
    const isEligibleDocument =
      !!document.documentElement &&
      (document.contentType === 'text/html' ||
        document.contentType === 'application/xhtml+xml');

    if (!isEligibleDocument || window.__designerFeedbackInjected) {
      return;
    }

    window.__designerFeedbackInjected = true;
    const lifecycle = createToolbarLifecycle(() => mountUI(ctx));

    async function ensureInjected(): Promise<void> {
      await lifecycle.enable();
    }

    contentMessenger.onMessage('showToolbar', () => {
      ensureInjected().catch(error => {
        console.error('Failed to show toolbar:', error);
      });
    });

    contentMessenger.onMessage('getAnnotationCount', async ({data: url}) => {
      try {
        const targetUrl = url ?? getStorageKey();
        const count = await getAnnotationCount(targetUrl);
        return {count};
      } catch {
        return {count: 0};
      }
    });

    contentMessenger.onMessage('triggerExport', () => {
      ensureInjected()
        .then(() => {
          ctx.setTimeout(() => {
            emitUiEvent('open-export');
          }, 0);
        })
        .catch(error => {
          console.error('Failed to trigger export:', error);
        });
    });

    contentMessenger.onMessage('resumeExport', async ({data}) => {
      const request: ResumeExportRequest = data;
      if (request.format !== 'snapshot') {
        return {
          accepted: false,
          requestId: request.requestId,
          reason: 'unsupported-format',
        } satisfies ResumeExportResponse;
      }
      try {
        await ensureInjected();
        enqueueResumeExportRequest(request);
        return {
          accepted: true,
          requestId: request.requestId,
        } satisfies ResumeExportResponse;
      } catch (error) {
        console.error('Failed to resume export:', error);
        return {
          accepted: false,
          requestId: request.requestId,
          reason: 'injection-failed',
        } satisfies ResumeExportResponse;
      }
    });

    contentMessenger.onMessage('toggleToolbar', ({data: enabled}) => {
      if (enabled) {
        ensureInjected().catch(error => {
          console.error('Failed to toggle toolbar:', error);
        });
      } else {
        lifecycle.disable();
      }
    });

    let currentUrl = window.location.href;
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      const newUrl = window.location.href;
      const oldUrl = currentUrl;
      currentUrl = newUrl;

      try {
        const oldParsed = new URL(oldUrl);
        const newParsed = new URL(newUrl);
        const oldKey = oldParsed.origin + oldParsed.pathname + oldParsed.search;
        const newKey = newParsed.origin + newParsed.pathname + newParsed.search;

        if (oldKey !== newKey) {
          emitUiEvent('location-changed', {newUrl, oldUrl});
        }
      } catch {
        emitUiEvent('location-changed', {newUrl, oldUrl});
      }
    });

    ctx.onInvalidated(() => {
      lifecycle.dispose();
      delete window.__designerFeedbackInjected;
    });
  },
});
