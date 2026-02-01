import {browser} from 'wxt/browser';

interface TargetInfo {
  targetOrigin: string;
  targetUrl: string;
}

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
        await browser.tabs.sendMessage(targetTab.id!, {
          id: Date.now(),
          type: 'showToolbar',
          data: undefined,
          timestamp: Date.now(),
        });
        return true;
      } catch {
        return false;
      }
    };

    const firstAttempt = await sendShowToolbar();
    let shown = firstAttempt;
    if (!firstAttempt) {
      await new Promise(resolve => setTimeout(resolve, 100));
      shown = await sendShowToolbar();
    }

    debug.toolbarShown = shown;

    window.__dfActivateDebug = debug;
    window.__dfActivateStatus = 'done';
  } catch (error: unknown) {
    window.__dfActivateStatus = `error:${String(error)}`;
    window.__dfActivateDebug = {
      error: String(error),
    };
  }
}

const params = new URLSearchParams(window.location.search);
const targetInfo = getTargetInfo(params);
void activate(targetInfo);
