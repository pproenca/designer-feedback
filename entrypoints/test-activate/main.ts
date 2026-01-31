

import { browser } from 'wxt/browser';

async function activate(): Promise<void> {
  window.__dfActivateStatus = 'pending';

  try {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target') || '';
    const targetUrl = target.trim();
    const targetOrigin = targetUrl ? new URL(targetUrl).origin : '';

    const tabs = await browser.tabs.query({});
    window.__dfActivateDebug = {
      tabs: tabs.map((tab) => tab.url || ''),
    };

    const exactMatch = tabs.find((tab) => tab.url === targetUrl);
    const originMatch = tabs.find(
      (tab) => targetOrigin && tab.url && tab.url.startsWith(targetOrigin)
    );
    const targetTab = exactMatch || originMatch;

    if (!targetTab?.id) {
      window.__dfActivateStatus = 'error:target-tab-not-found';
      return;
    }

    const manifest = browser.runtime.getManifest();
    const files = manifest.content_scripts?.flatMap((script) => script.js ?? []) ?? [];
    const uniqueFiles = Array.from(new Set(files));
    const scriptFiles = uniqueFiles.length > 0 ? uniqueFiles : ['content-scripts/content.js'];

    window.__dfActivateDebug.scriptFiles = scriptFiles;

    try {
      const injectionResult = await browser.scripting.executeScript({
        target: { tabId: targetTab.id },
        files: scriptFiles,
      });
      window.__dfActivateDebug.injectionResult = injectionResult;
    } catch (injectionError) {
      window.__dfActivateDebug.injectionError = String(injectionError);
      window.__dfActivateStatus = `error:injection-failed:${String(injectionError)}`;
      return;
    }


    const [flagCheckResult] = await browser.scripting.executeScript({
      target: { tabId: targetTab.id },
      func: () => ({
        flag: window.__designerFeedbackInjected,
        url: window.location.href,
      }),
    });
    window.__dfActivateDebug.flagCheck = flagCheckResult?.result;


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
    if (!firstAttempt) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await sendShowToolbar();
    }

    window.__dfActivateStatus = 'done';
  } catch (error) {
    window.__dfActivateStatus = `error:${String(error)}`;
    window.__dfActivateDebug = {
      error: String(error),
    };
  }
}

activate();
