import {defineBackground} from '#imports';
import type {Browser} from 'wxt/browser';
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
} from '@/utils/background-helpers';
import {pendingCaptureTabs} from '@/utils/storage-items';
import {backgroundMessenger, contentMessenger} from '@/utils/messaging';

export default defineBackground(() => {
  const pendingCaptureTtlMs = 120000;
  const contextMenuId = 'df-export-snapshot';

  function trimExpiredPending(
    current: Record<string, number>
  ): Record<string, number> {
    const now = Date.now();
    let changed = false;
    const next: Record<string, number> = {...current};
    for (const [key, startedAt] of Object.entries(current)) {
      if (!startedAt || now - startedAt > pendingCaptureTtlMs) {
        delete next[key];
        changed = true;
      }
    }
    return changed ? next : current;
  }

  async function markPendingCapture(tabId: number): Promise<void> {
    const key = String(tabId);
    const current = await pendingCaptureTabs.getValue();
    const trimmed = trimExpiredPending(current);
    await pendingCaptureTabs.setValue({...trimmed, [key]: Date.now()});
  }

  async function hasPendingCapture(tabId: number): Promise<boolean> {
    const key = String(tabId);
    const current = await pendingCaptureTabs.getValue();
    if (!current[key]) return false;
    const trimmed = trimExpiredPending(current);
    if (trimmed !== current) {
      await pendingCaptureTabs.setValue(trimmed);
    }
    return Boolean(trimmed[key]);
  }

  async function clearPendingCapture(tabId: number): Promise<void> {
    const key = String(tabId);
    const current = await pendingCaptureTabs.getValue();
    if (!current[key]) return;
    const next = {...current};
    delete next[key];
    await pendingCaptureTabs.setValue(next);
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

  async function sendResumeExport(tabId: number): Promise<void> {
    await contentMessenger.sendMessage('resumeExport', undefined, tabId);
  }

  async function sendResumeExportWithRetry(tabId: number): Promise<boolean> {
    try {
      await sendResumeExport(tabId);
      return true;
    } catch {
      try {
        await new Promise(resolve => setTimeout(resolve, 80));
        await sendResumeExport(tabId);
        return true;
      } catch {
        return false;
      }
    }
  }

  function isActiveTabPermissionError(error: string): boolean {
    const normalized = error.toLowerCase();
    if (
      normalized.includes('max_capture_visible_tab_calls_per_second') ||
      normalized.includes('rate') ||
      normalized.includes('quota')
    ) {
      return false;
    }
    return (
      normalized.includes('activetab') ||
      normalized.includes('not allowed to access') ||
      normalized.includes('cannot access contents of the page') ||
      normalized.includes('permission') ||
      normalized.includes('missing host permission')
    );
  }

  async function handleUserInvocation(tab: Browser.tabs.Tab | undefined) {
    if (!tab?.id || !tab.url) return;
    if (!isInjectableUrl(tab.url)) return;

    await showToolbar(tab.id);

    if (await hasPendingCapture(tab.id)) {
      const resumed = await sendResumeExportWithRetry(tab.id);
      if (resumed) {
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

  backgroundMessenger.onMessage('captureScreenshot', async ({sender}) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }
    try {
      const windowId = await getWindowIdForCapture(sender.tab?.windowId);
      const result = await captureVisibleTabScreenshot(windowId);
      if (result.error && sender.tab?.id) {
        if (isActiveTabPermissionError(result.error)) {
          await markPendingCapture(sender.tab.id);
          return {...result, errorCode: 'activeTab-required' as const};
        }
      } else if (sender.tab?.id) {
        await clearPendingCapture(sender.tab.id);
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
