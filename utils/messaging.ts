// =============================================================================
// Content <-> Background Messaging Utilities
// =============================================================================

import { parseMessage, type Message } from './schemas';

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

/**
 * Send a validated message to the background service worker with timeout handling.
 * Validates the message against the schema before sending.
 *
 * @param message - The message to send (will be validated)
 * @param timeoutMs - Timeout in milliseconds (default: 30000ms)
 * @throws Error if message validation fails
 */
export async function sendValidatedMessage<T>(message: Message, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  // Validate outgoing message
  const validated = parseMessage(message);
  if (!validated) {
    throw new Error('Invalid outgoing message format');
  }
  return sendMessage<T>(validated, timeoutMs);
}
