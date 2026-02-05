import {defineExtensionMessaging} from '@webext-core/messaging';
import type {PendingCaptureFormat, Settings} from '@/types';

export type CaptureScreenshotErrorCode =
  | 'activeTab-required'
  | 'capture-rate-limited';
export type CaptureScreenshotResponse = {
  data: string;
  error?: string;
  errorCode?: CaptureScreenshotErrorCode;
};

export type ResumeExportRequest = {
  requestId: string;
  format: PendingCaptureFormat;
};

export type ResumeExportResponse = {
  accepted: boolean;
  requestId: string;
  reason?: string;
};

interface BackgroundProtocolMap {
  captureScreenshot(): CaptureScreenshotResponse;
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
  resumeExport(params: ResumeExportRequest): ResumeExportResponse;
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
