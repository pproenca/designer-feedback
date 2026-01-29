// =============================================================================
// Background Service Worker Helper Functions
// Extracted for testability - these pure/semi-pure functions can be unit tested
// =============================================================================

import type { Settings } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { hashString } from '@/utils/hash';
import {
  OFFSCREEN_DOCUMENT_PATH,
  MESSAGE_TARGET,
  OFFSCREEN_MESSAGE_TYPE,
} from '@/utils/offscreen-constants';

// =============================================================================
// URL Utilities
// =============================================================================

/**
 * Check if a URL is injectable (http/https only)
 */
export function isInjectableUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Get origin from URL
 */
export function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/**
 * Get hash of origin string for comparison
 */
export function getOriginHash(origin: string): string {
  return hashString(origin);
}

/**
 * Get origin pattern for permissions API
 */
export function getOriginPattern(origin: string): string {
  return `${origin}/*`;
}

/**
 * Normalize an origin hash - if it's a full URL, hash it; otherwise return as-is
 */
export function normalizeOriginHash(value: string): string {
  if (value.includes('://')) {
    return hashString(value);
  }
  return value;
}

// =============================================================================
// Screenshot Capture
// =============================================================================

export type ScreenshotResult = { data: string; error?: string };

/**
 * Get windowId for screenshot capture, with fallback to active tab query
 * @param senderTabWindowId - windowId from sender.tab (may be undefined)
 * @returns windowId to use for captureVisibleTab
 */
export async function getWindowIdForCapture(senderTabWindowId: number | undefined): Promise<number> {
  if (senderTabWindowId !== undefined) {
    console.log('[Background] Using sender.tab.windowId:', senderTabWindowId);
    return senderTabWindowId;
  }

  // Fallback: query for the active tab in the current window
  console.log('[Background] sender.tab.windowId is undefined, querying active tab...');
  try {
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.windowId !== undefined) {
      console.log('[Background] Fallback to active tab windowId:', activeTab.windowId, 'tabId:', activeTab.id);
      return activeTab.windowId;
    }
  } catch (error) {
    console.warn('[Background] Failed to query active tab:', error);
  }

  // Last resort: use WINDOW_ID_CURRENT
  console.log('[Background] Using WINDOW_ID_CURRENT as last resort');
  return browser.windows.WINDOW_ID_CURRENT;
}

/**
 * Verify screenshot permission for a URL
 * @param url - The URL to check permission for
 * @returns true if permission is granted, false otherwise
 */
export async function verifyScreenshotPermission(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    const hasPermission = await browser.permissions.contains({
      origins: [`${origin}/*`],
    });
    console.log('[Background] Permission check for', url, ':', hasPermission);
    return hasPermission;
  } catch (error) {
    console.error('[Background] Permission check failed:', error);
    return false;
  }
}

/**
 * Capture screenshot of the visible tab (background service worker implementation)
 */
export async function captureVisibleTabScreenshot(windowId: number): Promise<ScreenshotResult> {
  console.log('[Background] captureScreenshot called with windowId:', windowId);
  console.log('[Background] WINDOW_ID_CURRENT:', browser.windows.WINDOW_ID_CURRENT);
  console.log('[Background] windowId === WINDOW_ID_CURRENT:', windowId === browser.windows.WINDOW_ID_CURRENT);
  try {
    console.log('[Background] Calling captureVisibleTab...');
    const dataUrl = await browser.tabs.captureVisibleTab(windowId, { format: 'png' });
    console.log('[Background] captureVisibleTab result:', {
      hasData: !!dataUrl,
      length: dataUrl?.length ?? 0,
    });
    if (!dataUrl) {
      return { data: '', error: 'captureVisibleTab returned empty' };
    }
    return { data: dataUrl };
  } catch (error) {
    console.error('[Background] captureVisibleTab failed:', error);
    return { data: '', error: String(error) };
  }
}

// =============================================================================
// Offscreen Document Management
// =============================================================================

/**
 * Check if an offscreen document already exists
 * Uses getContexts API with fallback for older Chrome versions
 */
export async function hasOffscreenDocument(): Promise<boolean> {
  try {
    // Use browser.runtime.getContexts to check for existing offscreen document
    const existingContexts = await browser.runtime.getContexts({
      contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
      documentUrls: [browser.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return existingContexts.length > 0;
  } catch {
    // Fallback for older Chrome versions that don't support getContexts
    // This can happen in Chrome < 116
    return false;
  }
}

/**
 * Ensure offscreen document exists for blob URL creation
 */
export async function setupOffscreenDocument(): Promise<void> {
  console.log('[Background] setupOffscreenDocument called');

  // Check if offscreen document already exists
  const exists = await hasOffscreenDocument();
  console.log('[Background] Offscreen document exists:', exists);

  if (exists) {
    return;
  }

  // Create offscreen document for blob URL creation
  console.log('[Background] Creating offscreen document...');
  await browser.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: [browser.offscreen.Reason.BLOBS],
    justification: 'Convert data URL to blob URL for downloading screenshots',
  });
  // Small delay to ensure script is loaded
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log('[Background] Offscreen document created and ready');
}

// =============================================================================
// File Download
// =============================================================================

export type DownloadResult = { ok: boolean; downloadId?: number; error?: string };

/**
 * Download a file from a data URL using offscreen document for blob conversion
 */
export async function downloadFile(
  dataUrl: string,
  filename: string
): Promise<DownloadResult> {
  console.log('[Background] downloadFile called', { filename, dataUrlLength: dataUrl.length });
  try {
    // Create offscreen document for blob URL creation
    await setupOffscreenDocument();

    // Send data URL to offscreen document for conversion to blob URL
    console.log('[Background] Sending OFFSCREEN_DOWNLOAD message...');
    const response = (await browser.runtime.sendMessage({
      type: OFFSCREEN_MESSAGE_TYPE.DOWNLOAD,
      target: MESSAGE_TARGET.OFFSCREEN,
      dataUrl,
    })) as { ok: boolean; blobUrl?: string; error?: string } | undefined;
    console.log('[Background] OFFSCREEN_DOWNLOAD response:', JSON.stringify(response));

    if (!response?.ok || !response?.blobUrl) {
      return { ok: false, error: response?.error ?? 'Blob conversion failed' };
    }

    // Download using blob URL (from offscreen document context)
    console.log('[Background] Starting download with blob URL...');
    const downloadId = await browser.downloads.download({
      url: response.blobUrl,
      filename,
      saveAs: false,
    });
    console.log('[Background] Download started, id:', downloadId);

    if (downloadId === undefined) {
      return { ok: false, error: 'Download failed to start' };
    }

    return { ok: true, downloadId };
  } catch (error) {
    console.error('[Background] Download failed:', error);
    return { ok: false, error: String(error) };
  }
}

// =============================================================================
// Settings Management
// =============================================================================

export type SettingsResult = { settings: Settings; error?: string };

/**
 * Get settings from sync storage
 */
export async function getSettings(): Promise<SettingsResult> {
  try {
    const result = await browser.storage.sync.get(DEFAULT_SETTINGS);
    return { settings: result as Settings };
  } catch (error) {
    console.error('Failed to get settings:', error);
    return { settings: DEFAULT_SETTINGS, error: String(error) };
  }
}

/**
 * Save settings to sync storage
 */
export async function saveSettings(settings: Settings): Promise<SettingsResult> {
  try {
    await browser.storage.sync.set(settings);
    return { settings };
  } catch (error) {
    console.error('Failed to save settings:', error);
    return { settings, error: String(error) };
  }
}

// =============================================================================
// Badge Management
// =============================================================================

/**
 * Update the extension badge
 */
export function updateBadge(count: number): void {
  if (count > 0) {
    browser.action.setBadgeText({ text: String(count) });
    browser.action.setBadgeBackgroundColor({ color: '#3C82F7' });
  } else {
    browser.action.setBadgeText({ text: '' });
  }
}

// =============================================================================
// Security
// =============================================================================

/**
 * Check if a message sender is from this extension
 */
export function isExtensionSender(sender: { id?: string }): boolean {
  return sender.id === browser.runtime.id;
}

// =============================================================================
// Tab Tracking
// =============================================================================

export const ACTIVATED_TABS_KEY = 'designer-feedback:activated-tabs';

/**
 * Check if session storage is available
 */
export function canUseSessionStorage(): boolean {
  return typeof browser !== 'undefined' && Boolean(browser.storage?.session);
}

/**
 * Persist activated tabs to session storage
 */
export function persistActivatedTabs(activatedTabs: Map<number, string>): void {
  if (!canUseSessionStorage()) return;
  const payload: Record<string, string> = {};
  activatedTabs.forEach((origin, tabId) => {
    payload[String(tabId)] = origin;
  });
  browser.storage.session.set({ [ACTIVATED_TABS_KEY]: payload }).catch((error) => {
    console.warn('Failed to persist activated tabs:', error);
  });
}

/**
 * Restore activated tabs from session storage
 */
export async function restoreActivatedTabs(
  activatedTabs: Map<number, string>
): Promise<boolean> {
  if (!canUseSessionStorage()) return false;
  try {
    const result = await browser.storage.session.get({ [ACTIVATED_TABS_KEY]: {} });
    const stored = result[ACTIVATED_TABS_KEY] as Record<string, string>;
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

/**
 * Check if manifest has optional host permissions
 */
export function hasOptionalHostPermissions(): boolean {
  try {
    const manifest = browser.runtime.getManifest() as { optional_host_permissions?: string[] };
    const optional = manifest.optional_host_permissions;
    return Array.isArray(optional) && optional.length > 0;
  } catch {
    return false;
  }
}

/**
 * Ensure host permission is granted for an origin
 */
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

/**
 * Get content script files from manifest
 */
export function getContentScriptFiles(): string[] {
  const manifest = browser.runtime.getManifest();
  const scripts = manifest.content_scripts ?? [];
  const files = scripts.flatMap((script) => script.js ?? []);
  const uniqueFiles = Array.from(new Set(files));
  if (uniqueFiles.length > 0) {
    return uniqueFiles;
  }
  // Fallback for programmatic-only injection (no manifest content_scripts)
  return ['content-scripts/content.js'];
}
