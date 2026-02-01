import type {Settings} from '@/types';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {settingsEnabled, settingsLightMode} from '@/utils/storage-items';

export function isInjectableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export type ScreenshotResult = {data: string; error?: string};

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

function createBlobUrl(dataUrl: string): string {
  const blob = dataUrlToBlob(dataUrl);
  return URL.createObjectURL(blob);
}

function scheduleRevokeBlobUrl(blobUrl: string): void {
  setTimeout(() => URL.revokeObjectURL(blobUrl), DOWNLOAD_URL_REVOKE_DELAY_MS);
}

export async function downloadFile(
  dataUrl: string,
  filename: string
): Promise<DownloadResult> {
  let blobUrl: string | null = null;
  try {
    blobUrl = createBlobUrl(dataUrl);

    const downloadId = await browser.downloads.download({
      url: blobUrl,
      filename,
      saveAs: false,
    });

    if (downloadId === undefined) {
      return {ok: false, error: 'Download failed to start'};
    }

    scheduleRevokeBlobUrl(blobUrl);
    return {ok: true, downloadId};
  } catch (error) {
    console.error('[Background] Download failed:', error);
    if (blobUrl) {
      scheduleRevokeBlobUrl(blobUrl);
    }
    return {ok: false, error: String(error)};
  }
}

export type SettingsResult = {settings: Settings; error?: string};

export async function getSettings(): Promise<SettingsResult> {
  try {
    const [enabled, lightMode] = await Promise.all([
      settingsEnabled.getValue(),
      settingsLightMode.getValue(),
    ]);
    return {settings: {enabled, lightMode}};
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
      settingsEnabled.setValue(settings.enabled),
      settingsLightMode.setValue(settings.lightMode),
    ]);
    return {settings};
  } catch (error) {
    console.error('Failed to save settings:', error);
    return {settings, error: String(error)};
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
