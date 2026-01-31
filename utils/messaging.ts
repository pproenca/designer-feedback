// =============================================================================
// Type-Safe Extension Messaging with @webext-core/messaging
// =============================================================================

import { defineExtensionMessaging } from '@webext-core/messaging';
import type { Settings } from '@/types';

// =============================================================================
// Protocol Definitions
// =============================================================================

/**
 * Messages sent from content scripts TO the background service worker.
 * These are handled in entrypoints/background.ts
 */
interface BackgroundProtocolMap {
  captureScreenshot(): { data: string; error?: string };
  downloadFile(params: { filename: string; dataUrl: string }): { ok: boolean; error?: string };
  getSettings(): { settings: Settings; error?: string };
  saveSettings(settings: Settings): { settings: Settings; error?: string };
  updateBadge(count: number): void;
}

/**
 * Messages sent from background TO content scripts.
 * These are handled in entrypoints/content/index.ts
 */
interface ContentProtocolMap {
  getAnnotationCount(url?: string): { count: number };
  showToolbar(): void;
  triggerExport(): void;
  toggleToolbar(enabled: boolean): void;
}

// =============================================================================
// Messenger Instances
// =============================================================================

/**
 * Messenger for content → background communication.
 * - Content scripts use: backgroundMessenger.sendMessage(...)
 * - Background uses: backgroundMessenger.onMessage(...)
 */
export const backgroundMessenger = defineExtensionMessaging<BackgroundProtocolMap>();

/**
 * Messenger for background → content communication.
 * - Background uses: contentMessenger.sendMessage(...) with tabId
 * - Content scripts use: contentMessenger.onMessage(...)
 */
export const contentMessenger = defineExtensionMessaging<ContentProtocolMap>();

// =============================================================================
// Timeout Utility
// =============================================================================

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Wrap a promise with a timeout.
 * @webext-core/messaging doesn't have built-in timeout support.
 */
export async function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Message timeout: service worker did not respond')), ms);
  });
  return Promise.race([promise, timeoutPromise]);
}
