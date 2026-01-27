// =============================================================================
// Content <-> Background Messaging Utilities
// =============================================================================

/**
 * Send a message to the background service worker
 */
export function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Message channel error'));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Listen for messages from background or popup
 */
export function addMessageListener(
  callback: (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => void
): () => void {
  chrome.runtime.onMessage.addListener(callback);
  return () => chrome.runtime.onMessage.removeListener(callback);
}
