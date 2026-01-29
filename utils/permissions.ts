// =============================================================================
// Permission Utilities
// =============================================================================

/**
 * Check if we have host permission for a URL.
 * Host permission is required for captureVisibleTab when activeTab has expired.
 */
export async function hasHostPermission(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    const pattern = `${origin}/*`;
    return await browser.permissions.contains({ origins: [pattern] });
  } catch {
    return false;
  }
}

/**
 * Request host permission for a URL.
 * Must be called in response to user gesture (click handler).
 */
export async function requestHostPermission(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    const pattern = `${origin}/*`;
    return await browser.permissions.request({ origins: [pattern] });
  } catch {
    return false;
  }
}
