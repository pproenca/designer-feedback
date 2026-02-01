import {browser} from 'wxt/browser';
import {hashString} from '@/utils/hash';
import {activatedTabs} from '@/utils/storage-items';

type ActivationMode = 'auto' | 'gesture';

interface TargetInfo {
  targetOrigin: string;
  targetUrl: string;
}

function getOriginPattern(origin: string): string {
  return `${origin}/*`;
}

function getOriginHash(origin: string): string {
  return hashString(origin);
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

async function persistActivatedTab(
  tabId: number,
  origin: string
): Promise<void> {
  const stored = await activatedTabs.getValue();
  await activatedTabs.setValue({
    ...stored,
    [String(tabId)]: getOriginHash(origin),
  });
}

async function requestHostPermission(origin: string): Promise<boolean> {
  if (!origin) {
    return false;
  }
  if (!browser.permissions?.contains || !browser.permissions?.request) {
    return false;
  }

  const pattern = getOriginPattern(origin);
  try {
    const granted = await browser.permissions.contains({origins: [pattern]});
    if (granted) {
      return true;
    }
  } catch {
    // Continue to request permission.
  }

  try {
    const granted = await browser.permissions.request({origins: [pattern]});
    return Boolean(granted);
  } catch {
    return false;
  }
}

async function activate(
  mode: ActivationMode,
  targetInfo: TargetInfo
): Promise<void> {
  window.__dfActivateStatus = 'pending';
  const debug: Record<string, unknown> = {
    mode,
    targetOrigin: targetInfo.targetOrigin,
    targetUrl: targetInfo.targetUrl,
  };

  try {
    if (mode === 'gesture') {
      debug.permissionOrigin = getOriginPattern(targetInfo.targetOrigin);
      const permissionGranted = await requestHostPermission(
        targetInfo.targetOrigin
      );
      debug.permissionGranted = permissionGranted;
      if (!permissionGranted) {
        window.__dfActivateDebug = debug;
        window.__dfActivateStatus = 'error:permission-denied';
        return;
      }
    }

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
    if (shown && targetInfo.targetOrigin) {
      try {
        await persistActivatedTab(targetTab.id, targetInfo.targetOrigin);
        debug.persistedActivatedTab = true;
      } catch (error: unknown) {
        debug.persistedActivatedTab = false;
        debug.persistActivatedTabError = String(error);
      }
    }

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
const mode = params.get('mode') === 'gesture' ? 'gesture' : 'auto';
const targetInfo = getTargetInfo(params);

if (mode === 'gesture') {
  window.__dfActivateStatus = 'waiting-for-gesture';
  const button = document.createElement('button');
  button.dataset.activate = 'true';
  button.textContent = 'Activate toolbar';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.height = '100vh';
  button.style.width = '100vw';
  button.style.margin = '0';
  button.style.border = '0';
  button.style.background = '#111827';
  button.style.color = '#f9fafb';
  button.style.fontSize = '18px';
  button.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  button.addEventListener('click', () => void activate(mode, targetInfo));
  document.body.style.margin = '0';
  document.body.appendChild(button);
} else {
  void activate(mode, targetInfo);
}
