import {defineBackground} from '#imports';
import type {Browser} from 'wxt/browser';
import type {PendingCaptureRequest, PendingCaptureSource} from '@/types';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {
  captureVisibleTabScreenshot,
  downloadFile,
  getCaptureScreenshotErrorCode,
  getSettings,
  getWindowIdForCapture,
  isExtensionSender,
  migrateLegacyEnabledSetting,
  saveSettings,
  updateBadge,
} from '@/utils/background-helpers';
import {
  clearPendingCaptureForTab,
  createPendingCaptureRequest,
  didResumeExportAcknowledgeRequest,
  getPendingCaptureForTab,
  setPendingCaptureForTab,
  trimExpiredPendingCaptures,
} from '@/utils/pending-capture';
import {createPendingCaptureStoreAdapter} from '@/utils/pending-capture-store';
import {
  backgroundMessenger,
  contentMessenger,
  type ResumeExportRequest,
  type ResumeExportResponse,
} from '@/utils/messaging';
import {
  createContextMenuDefinitions,
  getContextMenuAction,
} from '@/utils/context-menu';
import {ActivationController} from './background/activation-controller';
import type {
  ActivationIntent,
  ActivationSource,
} from './background/activation-types';

export default defineBackground(() => {
  const activationController = new ActivationController();
  const pendingCaptureStore = createPendingCaptureStoreAdapter();

  void migrateLegacyEnabledSetting();

  async function readPendingCaptureStore(): Promise<
    Record<string, PendingCaptureRequest>
  > {
    const current = await pendingCaptureStore.getValue();
    const trimmed = trimExpiredPendingCaptures(current);
    if (trimmed !== current) {
      await pendingCaptureStore.setValue(trimmed);
    }
    return trimmed;
  }

  async function markPendingCapture(
    tabId: number,
    source: PendingCaptureSource = 'active-tab-retry'
  ): Promise<PendingCaptureRequest> {
    const current = await readPendingCaptureStore();
    const request = createPendingCaptureRequest('snapshot', source);
    const next = setPendingCaptureForTab(current, tabId, request);
    await pendingCaptureStore.setValue(next);
    return request;
  }

  async function getPendingCapture(
    tabId: number
  ): Promise<PendingCaptureRequest | null> {
    const current = await readPendingCaptureStore();
    return getPendingCaptureForTab(current, tabId);
  }

  async function clearPendingCapture(tabId: number): Promise<void> {
    const current = await pendingCaptureStore.getValue();
    const trimmed = trimExpiredPendingCaptures(current);
    const next = clearPendingCaptureForTab(trimmed, tabId);
    if (next !== current) {
      await pendingCaptureStore.setValue(next);
    }
  }

  async function sendResumeExport(
    tabId: number,
    request: ResumeExportRequest
  ): Promise<ResumeExportResponse> {
    return await contentMessenger.sendMessage('resumeExport', request, tabId);
  }

  async function sendResumeExportWithRetry(
    tabId: number,
    request: ResumeExportRequest
  ): Promise<ResumeExportResponse | null> {
    try {
      return await sendResumeExport(tabId, request);
    } catch {
      try {
        await new Promise(resolve => setTimeout(resolve, 80));
        return await sendResumeExport(tabId, request);
      } catch {
        return null;
      }
    }
  }

  async function resumePendingCaptureIfAny(tabId: number): Promise<void> {
    const pendingRequest = await getPendingCapture(tabId);
    if (!pendingRequest) {
      return;
    }

    const resumeRequest: ResumeExportRequest = {
      requestId: pendingRequest.requestId,
      format: pendingRequest.format,
      source: pendingRequest.source ?? 'active-tab-retry',
    };

    const resumed = await sendResumeExportWithRetry(tabId, resumeRequest);
    if (didResumeExportAcknowledgeRequest(pendingRequest, resumed)) {
      await clearPendingCapture(tabId);
    }
  }

  async function runActivationForInvocation(
    source: ActivationSource,
    intent: ActivationIntent,
    tab: Browser.tabs.Tab | undefined,
    pageUrl?: string
  ): Promise<void> {
    const tabId = tab?.id;
    const effectiveIntent =
      tabId && intent === 'toggle' && (await getPendingCapture(tabId))
        ? 'open'
        : intent;

    const result = await activationController.handleInvocation({
      source,
      intent: effectiveIntent,
      tab,
      pageUrl,
    });

    if (!result.ok || !tabId || result.action === 'closed') {
      return;
    }

    await resumePendingCaptureIfAny(tabId);
  }

  async function queueSnapshotExport(
    tab: Browser.tabs.Tab | undefined,
    pageUrl?: string
  ): Promise<void> {
    if (!tab?.id) {
      return;
    }

    try {
      await markPendingCapture(tab.id, 'context-menu');
    } catch (error) {
      console.error('Failed to queue snapshot export request:', error);
      return;
    }

    await runActivationForInvocation(
      'context-menu-export-snapshot',
      'open-and-export',
      tab,
      pageUrl
    );
  }

  async function registerContextMenus(): Promise<void> {
    if (!browser.contextMenus?.create || !browser.contextMenus?.removeAll) {
      return;
    }

    try {
      await browser.contextMenus.removeAll();
      for (const menuItem of createContextMenuDefinitions()) {
        browser.contextMenus.create(menuItem);
      }
    } catch (error) {
      console.warn('Failed to register context menus:', error);
    }
  }

  browser.action.onClicked.addListener(tab => {
    void runActivationForInvocation('action', 'toggle', tab);
  });

  browser.runtime.onInstalled.addListener(() => {
    updateBadge(0);
    void registerContextMenus();
    void migrateLegacyEnabledSetting();
  });

  browser.runtime.onStartup?.addListener(() => {
    void registerContextMenus();
    void migrateLegacyEnabledSetting();
  });

  browser.tabs.onRemoved.addListener(tabId => {
    activationController.clearTabState(tabId);
    void clearPendingCapture(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') {
      return;
    }
    activationController.clearTabState(tabId);
    void clearPendingCapture(tabId);
  });

  backgroundMessenger.onMessage('captureScreenshot', async ({sender}) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }

    try {
      const windowId = await getWindowIdForCapture(sender.tab?.windowId);
      const result = await captureVisibleTabScreenshot(windowId);
      const errorCode = getCaptureScreenshotErrorCode(result.error);

      if (result.error && sender.tab?.id) {
        if (errorCode === 'activeTab-required') {
          await markPendingCapture(sender.tab.id);
          return {...result, errorCode};
        }
      } else if (sender.tab?.id) {
        await clearPendingCapture(sender.tab.id);
      }

      if (result.error) {
        return {...result, errorCode};
      }

      return result;
    } catch (error) {
      console.error('[Background] captureScreenshot error:', error);
      return {data: '', error: String(error)};
    }
  });

  backgroundMessenger.onMessage('downloadFile', async ({data, sender}) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }

    try {
      return await downloadFile(data.dataUrl, data.filename);
    } catch (error) {
      console.error('[Background] downloadFile error:', error);
      return {ok: false, error: String(error)};
    }
  });

  backgroundMessenger.onMessage('getSettings', async ({sender}) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }

    try {
      return await getSettings();
    } catch (error) {
      return {settings: DEFAULT_SETTINGS, error: String(error)};
    }
  });

  backgroundMessenger.onMessage(
    'saveSettings',
    async ({data: settings, sender}) => {
      if (!isExtensionSender(sender)) {
        throw new Error('Invalid sender');
      }

      try {
        return await saveSettings(settings);
      } catch (error) {
        return {settings, error: String(error)};
      }
    }
  );

  backgroundMessenger.onMessage('updateBadge', ({data: count, sender}) => {
    if (!isExtensionSender(sender)) {
      return;
    }
    updateBadge(count);
  });

  browser.contextMenus?.onClicked.addListener((info, tab) => {
    const action = getContextMenuAction(info.menuItemId);
    if (!action) {
      return;
    }

    const pageUrl = info.pageUrl;

    if (action === 'open-toolbar') {
      void runActivationForInvocation(
        'context-menu-open-toolbar',
        'open',
        tab,
        pageUrl
      );
      return;
    }

    void queueSnapshotExport(tab, pageUrl);
  });
});
