// =============================================================================
// Screenshot Utilities
// =============================================================================

import { createPlaceholderScreenshot } from './screenshot/placeholder';
import { hideStickyElements, restoreHiddenElements } from './screenshot/sticky';
import { stitchScreenshots } from './screenshot/stitch';
import { backgroundMessenger, withTimeout } from './messaging';

export type FullPageCaptureResult = {
  dataUrl: string;
  isPlaceholder: boolean;
  mode: 'full' | 'viewport' | 'placeholder';
  error?: string;
};

/**
 * Check if the current page is a restricted page where screenshots cannot be captured
 * (chrome://, edge://, about:, etc.)
 */
export function isRestrictedPage(): boolean {
  try {
    const protocol = window.location.protocol;
    // Only http and https pages can be captured
    return protocol !== 'http:' && protocol !== 'https:';
  } catch {
    return true;
  }
}

/**
 * Capture the visible tab screenshot via the background service worker
 */
export async function captureScreenshot(): Promise<string> {
  const response = await withTimeout(
    backgroundMessenger.sendMessage('captureScreenshot', undefined)
  );

  if (response.error) {
    throw new Error(response.error);
  }
  // Check for non-empty data (empty string is falsy but explicit check is clearer)
  if (response.data && response.data.length > 0) {
    return response.data;
  }
  throw new Error('Failed to capture screenshot: empty response');
}

/**
 * Capture full page by scrolling through the document and stitching screenshots.
 * Uses activeTab permission which is granted when user clicks the extension icon.
 */
export async function captureFullPage(): Promise<FullPageCaptureResult> {
  try {
    return { dataUrl: await captureFullPageFromExtension(), isPlaceholder: false, mode: 'full' };
  } catch (error) {
    console.warn('Extension screenshot capture failed, using placeholder.', error);
    try {
      const fallback = await captureScreenshotWithRetry();
      return {
        dataUrl: fallback,
        isPlaceholder: false,
        mode: 'viewport',
        error: error instanceof Error ? error.message : String(error),
      };
    } catch (fallbackError) {
      console.warn('Viewport screenshot capture failed, using placeholder.', fallbackError);
    }
    return {
      dataUrl: createPlaceholderScreenshot(),
      isPlaceholder: true,
      mode: 'placeholder',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const CAPTURE_RETRY_DELAY_MS = 180;
const CAPTURE_RETRY_COUNT = 2;
const MIN_CAPTURE_INTERVAL_MS = 1100;
const RATE_LIMIT_BACKOFF_MS = 1400;

let lastCaptureAt = 0;

async function captureScreenshotThrottled(): Promise<string> {
  const now = Date.now();
  const wait = MIN_CAPTURE_INTERVAL_MS - (now - lastCaptureAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  try {
    const result = await captureScreenshot();
    lastCaptureAt = Date.now();
    return result;
  } catch (error) {
    lastCaptureAt = Date.now();
    throw error;
  }
}

function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND');
}

async function captureScreenshotWithRetry(retries: number = CAPTURE_RETRY_COUNT): Promise<string> {
  try {
    return await captureScreenshotThrottled();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    const delay = isRateLimitError(error) ? RATE_LIMIT_BACKOFF_MS : CAPTURE_RETRY_DELAY_MS;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return captureScreenshotWithRetry(retries - 1);
  }
}

async function captureFullPageFromExtension(): Promise<string> {
  // Save original scroll position
  const originalScrollY = window.scrollY;

  // Get document dimensions
  const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const maxScrollY = Math.max(0, docHeight - viewportHeight);

  // Calculate number of captures needed
  const numCaptures = Math.max(1, Math.ceil(docHeight / viewportHeight));
  const screenshots: string[] = [];
  const scrollPositions: number[] = [];

  try {
    // Capture each viewport section
    for (let i = 0; i < numCaptures; i++) {
      const scrollY = Math.min(i * viewportHeight, maxScrollY);
      scrollPositions.push(scrollY);
      window.scrollTo(0, scrollY);

      // Wait for render
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 80);
        });
      });

      const isFirst = i === 0;
      const isLast = i === numCaptures - 1;
      let hidden: ReturnType<typeof hideStickyElements> = [];
      try {
        if (!isFirst) {
          hidden = hidden.concat(hideStickyElements('top'));
        }
        if (!isLast) {
          hidden = hidden.concat(hideStickyElements('bottom'));
        }

        const screenshot = await captureScreenshotWithRetry();
        screenshots.push(screenshot);
      } finally {
        restoreHiddenElements(hidden);
      }
    }
  } finally {
    // Restore scroll position
    window.scrollTo(0, originalScrollY);
  }

  // Stitch screenshots on canvas
  return stitchScreenshots(screenshots, viewportWidth, viewportHeight, docHeight, dpr, scrollPositions);
}
