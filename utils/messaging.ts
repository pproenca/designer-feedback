// =============================================================================
// Content <-> Background Messaging Utilities
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Send a message to the background service worker with timeout handling.
 * If no response is received within the timeout, the promise rejects.
 *
 * @param message - The message to send
 * @param timeoutMs - Timeout in milliseconds (default: 30000ms)
 */
export function sendMessage<T>(message: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Message timeout: service worker did not respond'));
      }
    }, timeoutMs);

    browser.runtime.sendMessage(message).then((response) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(response as T);
    }).catch((error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(String(error) || 'Message channel error'));
    });
  });
}
