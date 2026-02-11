import {browser} from 'wxt/browser';
import {contentMessenger} from '@/utils/messaging';

interface TargetInfo {
  targetOrigin: string;
  targetUrl: string;
}

const isE2E = import.meta.env.VITE_DF_E2E === '1';

function getTargetInfo(params: URLSearchParams): TargetInfo {
  const target = params.get('target') ?? '';
  const targetUrl = target.trim();
  if (!targetUrl) {
    return {targetOrigin: '', targetUrl: ''};
  }

  try {
    return {targetOrigin: new URL(targetUrl).origin, targetUrl};
  } catch {
    return {targetOrigin: '', targetUrl: ''};
  }
}

async function activate(targetInfo: TargetInfo): Promise<void> {
  window.__dfActivateStatus = 'pending';
  const debug: Record<string, unknown> = {
    mode: 'auto',
    targetOrigin: targetInfo.targetOrigin,
    targetUrl: targetInfo.targetUrl,
  };

  try {
    const tabs = await browser.tabs.query({});
    debug.tabs = tabs.map(tab => tab.url || '');

    const exactMatch = tabs.find(tab => tab.url === targetInfo.targetUrl);
    const originMatch = tabs.find(
      tab =>
        targetInfo.targetOrigin &&
        tab.url &&
        tab.url.startsWith(targetInfo.targetOrigin)
    );
    const targetTab = exactMatch || originMatch;

    if (!targetTab?.id) {
      window.__dfActivateDebug = debug;
      window.__dfActivateStatus = 'error:target-tab-not-found';
      return;
    }

    const manifest = browser.runtime.getManifest();
    const files =
      manifest.content_scripts?.flatMap(script => script.js ?? []) ?? [];
    const uniqueFiles = Array.from(new Set(files));
    const scriptFiles =
      uniqueFiles.length > 0 ? uniqueFiles : ['content-scripts/content.js'];

    debug.scriptFiles = scriptFiles;

    try {
      const injectionResult = await browser.scripting.executeScript({
        target: {tabId: targetTab.id},
        files: scriptFiles,
      });
      debug.injectionResult = injectionResult;
    } catch (injectionError) {
      debug.injectionError = String(injectionError);
      window.__dfActivateDebug = debug;
      window.__dfActivateStatus = `error:injection-failed:${String(injectionError)}`;
      return;
    }

    const [flagCheckResult] = await browser.scripting.executeScript({
      target: {tabId: targetTab.id},
      func: () => ({
        flag: window.__designerFeedbackInjected,
        url: window.location.href,
      }),
    });
    debug.flagCheck = flagCheckResult?.result;

    const sendShowToolbar = async (): Promise<boolean> => {
      try {
        const response = await contentMessenger.sendMessage(
          'showToolbar',
          undefined,
          targetTab.id!
        );
        debug.showResponse = response;
        return response?.mounted === true;
      } catch (error) {
        debug.showError = String(error);
        return false;
      }
    };

    const waitForMounted = async (): Promise<boolean> => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const status = await contentMessenger.sendMessage(
            'getToolbarStatus',
            undefined,
            targetTab.id!
          );
          debug.statusCheck = {attempt: attempt + 1, status};
          if (status.mounted) {
            return true;
          }
        } catch (error) {
          debug.statusCheckError = {attempt: attempt + 1, error: String(error)};
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return false;
    };

    const firstAttempt = await sendShowToolbar();
    let shown = firstAttempt;
    if (!firstAttempt) {
      await new Promise(resolve => setTimeout(resolve, 100));
      shown = await sendShowToolbar();
    }

    const mounted = shown ? await waitForMounted() : false;

    debug.toolbarShown = shown;
    debug.toolbarMounted = mounted;

    window.__dfActivateDebug = debug;
    window.__dfActivateStatus =
      shown && mounted ? 'done' : 'error:show-toolbar-failed';
  } catch (error: unknown) {
    window.__dfActivateStatus = `error:${String(error)}`;
    window.__dfActivateDebug = {
      error: String(error),
    };
  }
}

const params = new URLSearchParams(window.location.search);
const targetInfo = getTargetInfo(params);
if (!isE2E) {
  window.__dfActivateStatus = 'disabled';
  window.__dfActivateDebug = {
    reason: 'test-activate is only available in E2E builds',
  };
} else {
  void activate(targetInfo);
}
