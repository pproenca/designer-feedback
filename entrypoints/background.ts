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
import {pendingCaptureTabs, toolbarEnabledTabs} from '@/utils/storage-items';
import {
  clearToolbarEnabledForTab,
  isToolbarEnabledForTab,
  setToolbarEnabledForTab,
} from '@/utils/toolbar-toggle-state';
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

export default defineBackground(() => {
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

  async function isToolbarEnabled(tabId: number): Promise<boolean> {
    const current = await toolbarEnabledTabs.getValue();
    return isToolbarEnabledForTab(current, tabId);
  }

  async function setToolbarEnabled(
    tabId: number,
    enabled: boolean
  ): Promise<void> {
    const current = await toolbarEnabledTabs.getValue();
    const next = setToolbarEnabledForTab(current, tabId, enabled);
    if (next !== current) {
      await toolbarEnabledTabs.setValue(next);
    }
  }

  async function clearToolbarEnabled(tabId: number): Promise<void> {
    const current = await toolbarEnabledTabs.getValue();
    const next = clearToolbarEnabledForTab(current, tabId);
    if (next !== current) {
      await toolbarEnabledTabs.setValue(next);
    }
  }

  async function clearTabInvocationState(tabId: number): Promise<void> {
    await Promise.all([clearPendingCapture(tabId), clearToolbarEnabled(tabId)]);
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

  function isNoReceiverError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('receiving end does not exist') ||
      message.includes('could not establish connection') ||
      message.includes('message port closed before a response was received')
    );
  }

  async function hideToolbar(tabId: number): Promise<boolean> {
    try {
      await contentMessenger.sendMessage('toggleToolbar', false, tabId);
      return true;
    } catch (error) {
      if (isNoReceiverError(error)) {
        return true;
      }
      console.error('Failed to hide toolbar:', error);
      return false;
    }
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

  async function resumePendingCaptureIfAny(tabId: number): Promise<void> {
    const pendingRequest = await getPendingCapture(tabId);
    if (pendingRequest) {
      const resumeRequest: ResumeExportRequest = {
        requestId: pendingRequest.requestId,
        format: pendingRequest.format,
      };
      const resumed = await sendResumeExportWithRetry(tabId, resumeRequest);
      if (didResumeExportAcknowledgeRequest(pendingRequest, resumed)) {
        await clearPendingCapture(tabId);
      }
    }
  }

  async function activateToolbar(tabId: number): Promise<boolean> {
    const shown = await showToolbar(tabId);
    if (!shown) {
      return false;
    }

    try {
      await setToolbarEnabled(tabId, true);
    } catch (error) {
      console.error('Failed to persist toolbar enabled state:', error);
    }

    await resumePendingCaptureIfAny(tabId);
    return true;
  }

  async function queueSnapshotExport(tabId: number): Promise<boolean> {
    try {
      await markPendingCapture(tabId);
    } catch (error) {
      console.error('Failed to queue snapshot export request:', error);
      return false;
    }
    return await activateToolbar(tabId);
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

  async function toggleToolbarForInvocation(tab: Browser.tabs.Tab | undefined) {
    if (!tab?.id || !tab.url) return;
    if (!isInjectableUrl(tab.url)) return;

    const pendingRequest = await getPendingCapture(tab.id);
    if (pendingRequest) {
      await activateToolbar(tab.id);
      return;
    }

    const enabled = await isToolbarEnabled(tab.id);
    if (enabled) {
      const hidden = await hideToolbar(tab.id);
      if (hidden) {
        try {
          await setToolbarEnabled(tab.id, false);
        } catch (error) {
          console.error('Failed to persist toolbar disabled state:', error);
        }
      }
      return;
    }

    await activateToolbar(tab.id);
  }

  browser.action.onClicked.addListener(async tab => {
    await toggleToolbarForInvocation(tab);
  });

  browser.runtime.onInstalled.addListener(() => {
    updateBadge(0);
    void registerContextMenus();
  });

  browser.runtime.onStartup?.addListener(() => {
    void registerContextMenus();
  });

  browser.commands.onCommand.addListener(async command => {
    if (command !== 'activate-toolbar') return;
    const [activeTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    await toggleToolbarForInvocation(activeTab);
  });

  browser.tabs.onRemoved.addListener(tabId => {
    void clearTabInvocationState(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status !== 'complete') {
      return;
    }
    void clearTabInvocationState(tabId);
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
    if (!action) return;
    if (!tab?.id || !tab.url) return;
    if (!isInjectableUrl(tab.url)) return;
    if (action === 'open-toolbar') {
      void activateToolbar(tab.id);
      return;
    }
    void queueSnapshotExport(tab.id);
  });
});
