/* global window, URLSearchParams, URL, chrome, setTimeout */

(async () => {
  window.__dfActivateStatus = 'pending';
  try {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('target') || '';
    const targetUrl = target.trim();
    const targetOrigin = targetUrl ? new URL(targetUrl).origin : '';

    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({}, (results) => resolve(results || []));
    });
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

    const manifest = chrome.runtime.getManifest();
    const files = manifest.content_scripts?.flatMap((script) => script.js ?? []) ?? [];
    const uniqueFiles = Array.from(new Set(files));
    const scriptFiles = uniqueFiles.length > 0 ? uniqueFiles : ['assets/content.js'];

    const injectionResult = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      files: scriptFiles,
    });
    window.__dfActivateDebug.injectionResult = injectionResult;

    const sendShowToolbar = () =>
      new Promise((resolve) => {
        chrome.tabs.sendMessage(targetTab.id, { type: 'SHOW_TOOLBAR' }, () => {
          const ok = !chrome.runtime.lastError;
          resolve(ok);
        });
      });

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
})();
