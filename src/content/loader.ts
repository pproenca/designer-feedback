(() => {
  const moduleUrl = chrome.runtime.getURL('assets/content.js');
  import(/* @vite-ignore */ moduleUrl).catch((error) => {
    console.error('Failed to load content script module:', error);
  });
})();
