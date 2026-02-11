import type {Settings} from '@/types';
import type {CaptureScreenshotErrorCode} from '@/utils/messaging';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {settingsEnabled, settingsLightMode} from '@/utils/storage-items';

export function isInjectableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export type ScreenshotResult = {data: string; error?: string};

const RATE_LIMIT_ERROR_PATTERNS: readonly string[] = [
  'max_capture_visible_tab_calls_per_second',
  'too many calls',
  'rate limit',
  'quota',
];

const ACTIVE_TAB_ERROR_PATTERNS: readonly string[] = [
  'activetab',
  'not allowed to access',
  'cannot access contents of the page',
  'missing host permission',
  'permission is required to use tabs.capturevisibletab',
];

export function getCaptureScreenshotErrorCode(
  error: string | undefined
): CaptureScreenshotErrorCode | undefined {
  if (!error) {
    return undefined;
  }
  const normalized = error.toLowerCase();
  if (RATE_LIMIT_ERROR_PATTERNS.some(pattern => normalized.includes(pattern))) {
    return 'capture-rate-limited';
  }
  if (ACTIVE_TAB_ERROR_PATTERNS.some(pattern => normalized.includes(pattern))) {
    return 'activeTab-required';
  }
  return undefined;
}

export async function getWindowIdForCapture(
  senderTabWindowId: number | undefined
): Promise<number> {
  return senderTabWindowId ?? browser.windows.WINDOW_ID_CURRENT;
}

export async function captureVisibleTabScreenshot(
  windowId: number
): Promise<ScreenshotResult> {
  try {
    const dataUrl = await browser.tabs.captureVisibleTab(windowId, {
      format: 'png',
    });
    if (!dataUrl) {
      return {data: '', error: 'captureVisibleTab returned empty'};
    }
    return {data: dataUrl};
  } catch (error) {
    console.error('[Background] captureVisibleTab failed:', error);
    return {data: '', error: String(error)};
  }
}

export type DownloadResult = {ok: boolean; downloadId?: number; error?: string};

const DOWNLOAD_URL_REVOKE_DELAY_MS = 60000;
const OFFSCREEN_DOCUMENT_URL = '/offscreen.html';
const OFFSCREEN_JUSTIFICATION =
  'Create blob URLs for large downloads when service workers lack DOM APIs';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  if (!header || data === undefined) {
    throw new Error('Invalid data URL');
  }
  const mimeMatch = header.match(/:(.*?)(;|$)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const isBase64 = header.includes(';base64');
  const byteString = isBase64 ? atob(data) : decodeURIComponent(data);
  const array = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    array[i] = byteString.charCodeAt(i);
  }
  return new Blob([array], {type: mime});
}

function createDownloadUrl(dataUrl: string): {
  url: string;
  revoke?: () => void;
} {
  if (typeof URL?.createObjectURL !== 'function') {
    return {url: dataUrl};
  }
  try {
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    return {url, revoke: () => URL.revokeObjectURL(url)};
  } catch (error) {
    console.warn(
      '[Background] createObjectURL failed, falling back to data URL:',
      error
    );
    return {url: dataUrl};
  }
}

function scheduleRevokeBlobUrl(revoke?: () => void): void {
  if (!revoke) {
    return;
  }
  setTimeout(revoke, DOWNLOAD_URL_REVOKE_DELAY_MS);
}

async function ensureOffscreenDocument(): Promise<boolean> {
  if (!browser.offscreen?.createDocument || !browser.offscreen?.hasDocument) {
    return false;
  }

  const hasDocument = await browser.offscreen.hasDocument();
  if (hasDocument) {
    return true;
  }

  await browser.offscreen.createDocument({
    url: browser.runtime.getURL(OFFSCREEN_DOCUMENT_URL),
    reasons: [browser.offscreen.Reason.BLOBS],
    justification: OFFSCREEN_JUSTIFICATION,
  });

  return true;
}

async function downloadFileViaOffscreen(
  dataUrl: string,
  filename: string
): Promise<DownloadResult | null> {
  if (
    !browser.offscreen?.createDocument ||
    !browser.offscreen?.hasDocument ||
    !browser.runtime?.sendMessage
  ) {
    return null;
  }

  let hadDocument = false;
  try {
    hadDocument = await browser.offscreen.hasDocument();
    if (!hadDocument) {
      const created = await ensureOffscreenDocument();
      if (!created) {
        return null;
      }
    }

    const response = (await browser.runtime.sendMessage({
      dfOffscreen: 'download',
      dataUrl,
      filename,
    })) as DownloadResult | undefined;

    if (response?.ok) {
      return response;
    }

    return {ok: false, error: response?.error ?? 'Offscreen download failed'};
  } catch (error) {
    console.warn('[Background] Offscreen download failed:', error);
    return {ok: false, error: String(error)};
  } finally {
    if (!hadDocument) {
      try {
        await browser.offscreen?.closeDocument?.();
      } catch (error) {
        console.warn('[Background] Failed to close offscreen document:', error);
      }
    }
  }
}

export async function downloadFile(
  dataUrl: string,
  filename: string
): Promise<DownloadResult> {
  let revokeBlobUrl: (() => void) | undefined;
  let downloadUrl: string | null = null;
  try {
    if (typeof URL?.createObjectURL !== 'function') {
      const offscreenResult = await downloadFileViaOffscreen(dataUrl, filename);
      if (offscreenResult?.ok) {
        return offscreenResult;
      }
      if (offscreenResult?.error) {
        console.warn(
          '[Background] Offscreen download unavailable, using data URL:',
          offscreenResult.error
        );
      }
    }

    const {url, revoke} = createDownloadUrl(dataUrl);
    downloadUrl = url;
    revokeBlobUrl = revoke;

    const downloadId = await browser.downloads.download({
      url: downloadUrl,
      filename,
      saveAs: false,
    });

    if (downloadId === undefined) {
      return {ok: false, error: 'Download failed to start'};
    }

    scheduleRevokeBlobUrl(revokeBlobUrl);
    return {ok: true, downloadId};
  } catch (error) {
    console.error('[Background] Download failed:', error);
    if (downloadUrl) {
      scheduleRevokeBlobUrl(revokeBlobUrl);
    }
    return {ok: false, error: String(error)};
  }
}

export type SettingsResult = {settings: Settings; error?: string};

export async function getSettings(): Promise<SettingsResult> {
  try {
    const lightMode = await settingsLightMode.getValue();
    return {settings: {lightMode}};
  } catch (error) {
    console.error('Failed to get settings:', error);
    return {settings: DEFAULT_SETTINGS, error: String(error)};
  }
}

export async function saveSettings(
  settings: Settings
): Promise<SettingsResult> {
  try {
    await Promise.all([
      // Keep the legacy key normalized so historical installs do not remain disabled.
      settingsEnabled.setValue(true),
      settingsLightMode.setValue(settings.lightMode),
    ]);
    return {settings};
  } catch (error) {
    console.error('Failed to save settings:', error);
    return {settings, error: String(error)};
  }
}

export async function migrateLegacyEnabledSetting(): Promise<void> {
  try {
    const enabled = await settingsEnabled.getValue();
    if (enabled === false) {
      await settingsEnabled.setValue(true);
    }
  } catch (error) {
    console.warn('Failed to migrate legacy enabled setting:', error);
  }
}

export function updateBadge(count: number): void {
  if (count > 0) {
    void browser.action.setBadgeText({text: String(count)});
    void browser.action.setBadgeBackgroundColor({color: '#3C82F7'});
  } else {
    void browser.action.setBadgeText({text: ''});
  }
}

export function isExtensionSender(sender: {id?: string}): boolean {
  return sender.id === browser.runtime.id;
}

export function getContentScriptFiles(): string[] {
  const manifest = browser.runtime.getManifest();
  const scripts = manifest.content_scripts ?? [];
  const files = scripts.flatMap(script => script.js ?? []);
  const uniqueFiles = Array.from(new Set(files));
  if (uniqueFiles.length > 0) {
    return uniqueFiles;
  }

  return ['content-scripts/content.js'];
}
