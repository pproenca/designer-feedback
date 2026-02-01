import {defineExtensionMessaging} from '@webext-core/messaging';
import type {Settings} from '@/types';

interface BackgroundProtocolMap {
  captureScreenshot(): {data: string; error?: string};
  downloadFile(params: {filename: string; dataUrl: string}): {
    ok: boolean;
    error?: string;
  };
  getSettings(): {settings: Settings; error?: string};
  saveSettings(settings: Settings): {settings: Settings; error?: string};
  updateBadge(count: number): void;
}

interface ContentProtocolMap {
  getAnnotationCount(url?: string): {count: number};
  showToolbar(): void;
  triggerExport(): void;
  toggleToolbar(enabled: boolean): void;
}

export const backgroundMessenger =
  defineExtensionMessaging<BackgroundProtocolMap>();

export const contentMessenger = defineExtensionMessaging<ContentProtocolMap>();

const DEFAULT_TIMEOUT_MS = 30000;

export async function withTimeout<T>(
  promise: Promise<T>,
  ms = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(new Error('Message timeout: service worker did not respond')),
      ms
    );
  });
  return Promise.race([promise, timeoutPromise]);
}
