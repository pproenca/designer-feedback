

import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { hashString } from '@/utils/hash';
import {
  activatedTabs as activatedTabsStorage,
  settingsEnabled,
  settingsLightMode,
} from '@/utils/storage-items';
import {
  OFFSCREEN_DOCUMENT_PATH,
  MESSAGE_TARGET,
  OFFSCREEN_MESSAGE_TYPE,
} from '@/utils/offscreen-constants';

export function isInjectableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function getOriginHash(origin: string): string {
  return hashString(origin);
}

export function getOriginPattern(origin: string): string {
  return `${origin}/*`;
}

export function normalizeOriginHash(value: string): string {
  if (value.includes('://')) {
    return hashString(value);
  }
  return value;
}

export type ScreenshotResult = { data: string; error?: string };

export async function getWindowIdForCapture(senderTabWindowId: number | undefined): Promise<number> {
  if (senderTabWindowId !== undefined) {
    return senderTabWindowId;
  }


  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.windowId !== undefined) {
      return activeTab.windowId;
    }
  } catch (error) {
    console.warn('[Background] Failed to query active tab:', error);
  }


  return browser.windows.WINDOW_ID_CURRENT;
}

export async function verifyScreenshotPermission(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    const hasPermission = await browser.permissions.contains({
      origins: [`${origin}/*`],
    });
    return hasPermission;
  } catch (error) {
    console.error('[Background] Permission check failed:', error);
    return false;
  }
}

export async function captureVisibleTabScreenshot(windowId: number): Promise<ScreenshotResult> {
  try {
    const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
    if (!dataUrl) {
      return { data: '', error: 'captureVisibleTab returned empty' };
    }
    return { data: dataUrl };
  } catch (error) {
    console.error('[Background] captureVisibleTab failed:', error);
    return { data: '', error: String(error) };
  }
}

export async function hasOffscreenDocument(): Promise<boolean> {
  try {

    const existingContexts = await browser.runtime.getContexts({
      contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return existingContexts.length > 0;
  } catch {


    return false;
  }
}

export async function setupOffscreenDocument(): Promise<void> {

  const exists = await hasOffscreenDocument();

  if (exists) {
    return;
  }


  await browser.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [browser.offscreen.Reason.BLOBS],
    justification: 'Convert data URL to blob URL for downloading screenshots',
  });

  await new Promise((resolve) => setTimeout(resolve, 100));
}

export type DownloadResult = { ok: boolean; downloadId?: number; error?: string };

export async function downloadFile(
  dataUrl: string,
  filename: string
): Promise<DownloadResult> {
  try {

    await setupOffscreenDocument();


    const response = (await browser.runtime.sendMessage({
      type: OFFSCREEN_MESSAGE_TYPE.DOWNLOAD,
      target: MESSAGE_TARGET.OFFSCREEN,
      dataUrl,
    })) as { ok: boolean; blobUrl?: string; error?: string } | undefined;

    if (!response?.ok || !response?.blobUrl) {
      return { ok: false, error: response?.error ?? 'Blob conversion failed' };
    }


    const downloadId = await browser.downloads.download({
      url: response.blobUrl,
      filename,
      saveAs: false,
    });

    if (downloadId === undefined) {
      return { ok: false, error: 'Download failed to start' };
    }

    return { ok: true, downloadId };
  } catch (error) {
    console.error('[Background] Download failed:', error);
    return { ok: false, error: String(error) };
  }
}

export type SettingsResult = { settings: Settings; error?: string };

export async function getSettings(): Promise<SettingsResult> {
  try {
    const [enabled, lightMode] = await Promise.all([
      settingsEnabled.getValue(),
      settingsLightMode.getValue(),
    ]);
    return { settings: { enabled, lightMode } };
  } catch (error) {
    console.error('Failed to get settings:', error);
    return { settings: DEFAULT_SETTINGS, error: String(error) };
  }
}

export async function saveSettings(settings: Settings): Promise<SettingsResult> {
  try {
    await Promise.all([
      settingsEnabled.setValue(settings.enabled),
      settingsLightMode.setValue(settings.lightMode),
    ]);
    return { settings };
  } catch (error) {
    console.error('Failed to save settings:', error);
    return { settings, error: String(error) };
  }
}

export function updateBadge(count: number): void {
  if (count > 0) {
    browser.action.setBadgeText({ text: String(count) });
    browser.action.setBadgeBackgroundColor({ color: '#3C82F7' });
  } else {
    browser.action.setBadgeText({ text: '' });
  }
}

export function isExtensionSender(sender: { id?: string }): boolean {
  return sender.id === browser.runtime.id;
}

export function persistActivatedTabs(activatedTabs: Map<number, string>): void {
  const payload: Record<string, string> = {};
  activatedTabs.forEach((origin, tabId) => {
    payload[String(tabId)] = origin;
  });
  activatedTabsStorage.setValue(payload).catch((error) => {
    console.warn('Failed to persist activated tabs:', error);
  });
}

export async function restoreActivatedTabs(
  activatedTabs: Map<number, string>
): Promise<boolean> {
  try {
    const stored = await activatedTabsStorage.getValue();
    let changed = false;
    Object.entries(stored ?? {}).forEach(([tabId, origin]) => {
      const id = Number(tabId);
      if (Number.isFinite(id) && origin) {
        const normalized = normalizeOriginHash(origin);
        if (normalized !== origin) {
          changed = true;
        }
        activatedTabs.set(id, normalized);
      }
    });
    const tabs = await browser.tabs.query({});
    const validIds = new Set(tabs.map((tab) => tab.id).filter(Boolean) as number[]);
    for (const id of activatedTabs.keys()) {
      if (!validIds.has(id)) {
        activatedTabs.delete(id);
        changed = true;
      }
    }
    return changed;
  } catch (error) {
    console.warn('Failed to restore activated tabs:', error);
    return false;
  }
}

export function hasOptionalHostPermissions(): boolean {
  try {
    const manifest = browser.runtime.getManifest() as { optional_host_permissions?: string[] };
    const optional = manifest.optional_host_permissions;
    return Array.isArray(optional) && optional.length > 0;
  } catch {
    return false;
  }
}

export async function ensureHostPermission(origin: string): Promise<boolean> {
  if (!origin) return false;
  if (!hasOptionalHostPermissions()) return false;
  if (!browser.permissions?.contains || !browser.permissions?.request) return false;

  const pattern = getOriginPattern(origin);
  try {
    const granted = await browser.permissions.contains({ origins: [pattern] });
    if (granted) return true;
  } catch {
    // continue to request
  }

  try {
    const granted = await browser.permissions.request({ origins: [pattern] });
    return Boolean(granted);
  } catch {
    return false;
  }
}

export function getContentScriptFiles(): string[] {
  const manifest = browser.runtime.getManifest();
  const scripts = manifest.content_scripts ?? [];
  const files = scripts.flatMap((script) => script.js ?? []);
  const uniqueFiles = Array.from(new Set(files));
  if (uniqueFiles.length > 0) {
    return uniqueFiles;
  }

  return ['content-scripts/content.js'];
}
