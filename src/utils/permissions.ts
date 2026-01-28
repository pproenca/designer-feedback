// =============================================================================
// Permission Utilities
// =============================================================================

import { sendMessage } from './messaging';

type PermissionResponse = { granted: boolean; error?: string };

function canUsePermissionsApi(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome?.permissions);
}

function canUseMessagingApi(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.sendMessage);
}

function resolveOrigins(origin?: string): string[] {
  if (origin && origin.trim().length > 0) {
    return [origin];
  }
  return ['<all_urls>'];
}

function hasOptionalHostPermissions(): boolean {
  try {
    const optional = chrome.runtime.getManifest().optional_host_permissions;
    return Array.isArray(optional) && optional.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check if the extension has screenshot permission
 */
export async function hasScreenshotPermission(origin?: string): Promise<boolean> {
  if (!hasOptionalHostPermissions()) {
    return true;
  }

  const origins = resolveOrigins(origin);

  if (canUsePermissionsApi() && chrome.permissions?.contains) {
    return new Promise((resolve) => {
      chrome.permissions.contains({ origins }, (granted) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(Boolean(granted));
      });
    });
  }

  if (!canUseMessagingApi()) {
    return false;
  }

  try {
    const response = await sendMessage<PermissionResponse>({
      type: 'CHECK_SCREENSHOT_PERMISSION',
      origin,
    });
    return Boolean(response?.granted);
  } catch {
    return false;
  }
}

/**
 * Request screenshot permission from the user
 * Returns true if granted, false if denied
 */
export async function requestScreenshotPermission(origin?: string): Promise<boolean> {
  if (!hasOptionalHostPermissions()) {
    return true;
  }

  const origins = resolveOrigins(origin);

  if (canUsePermissionsApi() && chrome.permissions?.request) {
    return new Promise((resolve) => {
      chrome.permissions.request({ origins }, (granted) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(Boolean(granted));
      });
    });
  }

  if (!canUseMessagingApi()) {
    return false;
  }

  try {
    const response = await sendMessage<PermissionResponse>({
      type: 'REQUEST_SCREENSHOT_PERMISSION',
      origin,
    });
    return Boolean(response?.granted);
  } catch {
    return false;
  }
}
