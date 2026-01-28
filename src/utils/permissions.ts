// =============================================================================
// Permission Utilities
// =============================================================================

/**
 * Check if the extension has screenshot permission (all_urls origin access)
 */
export async function hasScreenshotPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: ['<all_urls>'] }, resolve);
  });
}

/**
 * Request screenshot permission from the user
 * Returns true if granted, false if denied
 */
export async function requestScreenshotPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins: ['<all_urls>'] }, resolve);
  });
}
