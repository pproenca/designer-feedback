(() => {
  (async () => {
    try {
      await import('./index.tsx');
    } catch (error) {
      console.error('Failed to load content script module:', error);
    }
  })();
})();
