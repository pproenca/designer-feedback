import {defineBackground} from '#imports';
import type {Browser} from 'wxt/browser';
import type {PendingCaptureRequest} from '@/types';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {
  isInjectableUrl,
  captureVisibleTabScreenshot,
  getWindowIdForCapture,
  downloadFile,
  getSettings,
  saveSettings,
  updateBadge,
  isExtensionSender,
  getContentScriptFiles,
  getCaptureScreenshotErrorCode,
} from '@/utils/background-helpers';
import {
  clearPendingCaptureForTab,
  createPendingCaptureRequest,
  didResumeExportAcknowledgeRequest,
  getPendingCaptureForTab,
  setPendingCaptureForTab,
  trimExpiredPendingCaptures,
} from '@/utils/pending-capture';
import {pendingCaptureTabs} from '@/utils/storage-items';
import {
  backgroundMessenger,
  contentMessenger,
  type ResumeExportRequest,
  type ResumeExportResponse,
} from '@/utils/messaging';

export default defineBackground(() => {
  const contextMenuId = 'df-export-snapshot';

  async function readPendingCaptureStore(): Promise<
    Record<string, PendingCaptureRequest>
  > {
    const current = await pendingCaptureTabs.getValue();
    const trimmed = trimExpiredPendingCaptures(current);
    if (trimmed !== current) {
      await pendingCaptureTabs.setValue(trimmed);
    }
    return trimmed;
  }

  async function markPendingCapture(
    tabId: number
  ): Promise<PendingCaptureRequest> {
    const current = await readPendingCaptureStore();
    const request = createPendingCaptureRequest('snapshot');
    const next = setPendingCaptureForTab(current, tabId, request);
    await pendingCaptureTabs.setValue(next);
    return request;
  }

  async function getPendingCapture(
    tabId: number
  ): Promise<PendingCaptureRequest | null> {
    const current = await readPendingCaptureStore();
    return getPendingCaptureForTab(current, tabId);
  }

  async function clearPendingCapture(tabId: number): Promise<void> {
    const current = await pendingCaptureTabs.getValue();
    const trimmed = trimExpiredPendingCaptures(current);
    const next = clearPendingCaptureForTab(trimmed, tabId);
    if (next !== current) {
      await pendingCaptureTabs.setValue(next);
    }
  }

  async function injectContentScripts(tabId: number): Promise<boolean> {
    if (!browser.scripting?.executeScript) return false;
    const files = getContentScriptFiles();
    if (!files.length) return false;
    await browser.scripting.executeScript({target: {tabId}, files});
    return true;
  }

  async function sendShowToolbar(tabId: number): Promise<void> {
    await contentMessenger.sendMessage('showToolbar', undefined, tabId);
  }

  async function sendShowToolbarWithRetry(tabId: number): Promise<void> {
    try {
      await sendShowToolbar(tabId);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 60));
      await sendShowToolbar(tabId);
    }
  }

  async function showToolbar(tabId: number): Promise<boolean> {
    try {
      await sendShowToolbarWithRetry(tabId);
      return true;
    } catch (error) {
      try {
        const injected = await injectContentScripts(tabId);
        if (injected) {
          await sendShowToolbarWithRetry(tabId);
          return true;
        }
      } catch (retryError) {
        console.error('Failed to show toolbar after injection:', retryError);
        return false;
      }

      console.error('Failed to show toolbar:', error);
    }
    return false;
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

  async function handleUserInvocation(tab: Browser.tabs.Tab | undefined) {
    if (!tab?.id || !tab.url) return;
    if (!isInjectableUrl(tab.url)) return;

    await showToolbar(tab.id);

    const pendingRequest = await getPendingCapture(tab.id);
    if (pendingRequest) {
      const resumeRequest: ResumeExportRequest = {
        requestId: pendingRequest.requestId,
        format: pendingRequest.format,
      };
      const resumed = await sendResumeExportWithRetry(tab.id, resumeRequest);
      if (didResumeExportAcknowledgeRequest(pendingRequest, resumed)) {
        await clearPendingCapture(tab.id);
      }
    }
  }

  browser.action.onClicked.addListener(async tab => {
    await handleUserInvocation(tab);
  });

  browser.commands.onCommand.addListener(async command => {
    if (command !== 'activate-toolbar') return;
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    await handleUserInvocation(activeTab);
  });

  browser.tabs.onRemoved.addListener(tabId => {
    void clearPendingCapture(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') {
      return;
    }
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

  browser.runtime.onInstalled.addListener(() => {
    updateBadge(0);
    try {
      browser.contextMenus?.create({
        id: contextMenuId,
        title: 'Export feedback snapshot',
        contexts: ['page', 'selection', 'image', 'link'],
      });
    } catch (error) {
      console.warn('Failed to create context menu:', error);
    }
  });

  browser.contextMenus?.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== contextMenuId) return;
    void handleUserInvocation(tab);
  });
});
