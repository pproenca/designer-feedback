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
export async function sendMessage<T>(message: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Message timeout: service worker did not respond')), timeoutMs);
  });

  const messagePromise = browser.runtime.sendMessage(message).catch((error) => {
    throw new Error(String(error) || 'Message channel error');
  });

  return Promise.race([messagePromise, timeoutPromise]) as Promise<T>;
}
