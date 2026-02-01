import {defineBackground} from '#imports';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {
  isInjectableUrl,
  getOrigin,
  getOriginHash,
  normalizeOriginHash,
  captureVisibleTabScreenshot,
  getWindowIdForCapture,
  downloadFile,
  getSettings,
  saveSettings,
  updateBadge,
  isExtensionSender,
  persistActivatedTabs,
  restoreActivatedTabs,
  ensureHostPermission,
  getContentScriptFiles,
} from '@/utils/background-helpers';
import {activatedTabs as activatedTabsStorage} from '@/utils/storage-items';
import {backgroundMessenger, contentMessenger} from '@/utils/messaging';

export default defineBackground(() => {
  const activatedTabs = new Map<number, string>();

  restoreActivatedTabs(activatedTabs)
    .then(changed => {
      if (changed) {
        persistActivatedTabs(activatedTabs);
      }
    })
    .catch(error => {
      console.warn('Failed to restore activated tabs:', error);
    });

  async function getActivatedOriginHash(tabId: number): Promise<string | null> {
    const cached = activatedTabs.get(tabId);
    if (cached) return cached;
    try {
      const stored = await activatedTabsStorage.getValue();
      const origin = stored?.[String(tabId)];
      if (origin) {
        const normalized = normalizeOriginHash(origin);
        activatedTabs.set(tabId, normalized);
        return normalized;
      }
    } catch (error) {
      console.warn('Failed to read activated tab origin:', error);
    }
    return null;
  }

  function setActivatedTab(tabId: number, originHash: string): void {
    activatedTabs.set(tabId, originHash);
    persistActivatedTabs(activatedTabs);
  }

  function clearActivatedTab(tabId: number): void {
    activatedTabs.delete(tabId);
    persistActivatedTabs(activatedTabs);
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

  browser.action.onClicked.addListener(async tab => {
    if (!tab.id || !tab.url) return;

    if (!isInjectableUrl(tab.url)) {
      return;
    }

    const origin = getOrigin(tab.url);
    const originHash = getOriginHash(origin);
    const canPersist = await ensureHostPermission(origin);
    const shown = await showToolbar(tab.id);
    if (shown && canPersist) {
      setActivatedTab(tab.id, originHash);
    } else {
      clearActivatedTab(tab.id);
    }
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    const url = tab.url;
    void (async () => {
      const previousOriginHash = await getActivatedOriginHash(tabId);
      if (!previousOriginHash) return;

      const currentOrigin = getOrigin(url);
      const currentOriginHash = getOriginHash(currentOrigin);
      if (currentOriginHash === previousOriginHash) {
        const shown = await showToolbar(tabId);
        if (!shown) {
          clearActivatedTab(tabId);
        }
      } else {
        clearActivatedTab(tabId);
      }
    })();
  });

  browser.tabs.onRemoved.addListener(tabId => {
    clearActivatedTab(tabId);
  });

  backgroundMessenger.onMessage('captureScreenshot', async ({sender}) => {
    if (!isExtensionSender(sender)) {
      throw new Error('Invalid sender');
    }
    try {
      const windowId = await getWindowIdForCapture(sender.tab?.windowId);
      const result = await captureVisibleTabScreenshot(windowId);
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
  });
});
