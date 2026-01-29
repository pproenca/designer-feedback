// =============================================================================
// Screenshot Utilities
// =============================================================================

import { loadImage } from '@/utils/image';

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
  console.log('[Screenshot] Sending CAPTURE_SCREENSHOT message');
  const response = (await browser.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' })) as {
    type?: string;
    data?: string;
    error?: string;
  } | undefined;
  console.log('[Screenshot] Response:', JSON.stringify({
    responseType: typeof response,
    type: response?.type,
    error: response?.error ?? 'not set',
    hasData: !!response?.data,
    dataLength: response?.data?.length ?? 0,
  }));

  // Check if response is undefined (no listener responded)
  if (!response) {
    throw new Error('Failed to capture screenshot: no response from background');
  }

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
      let hidden: HiddenElementSnapshot[] = [];
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

const MAX_CANVAS_DIMENSION = 16384;
const MAX_CANVAS_AREA = 268_000_000;

type HiddenElementSnapshot = {
  element: HTMLElement;
  visibility: string;
  opacity: string;
  pointerEvents: string;
};

type StickyEdge = 'top' | 'bottom';

const EDGE_SAMPLE_POINTS = [0.1, 0.5, 0.9];
const EDGE_OFFSET_PX = 2;
const MIN_EDGE_HEIGHT_PX = 8;
const MAX_STICKY_HEIGHT_RATIO = 0.4;
const MIN_STICKY_WIDTH_RATIO = 0.6;

function hideStickyElements(edge: StickyEdge): HiddenElementSnapshot[] {
  const elements = collectStickyElements(edge);
  const hidden: HiddenElementSnapshot[] = [];

  elements.forEach((element) => {
    hidden.push({
      element,
      visibility: element.style.visibility,
      opacity: element.style.opacity,
      pointerEvents: element.style.pointerEvents,
    });

    element.style.visibility = 'hidden';
    element.style.opacity = '0';
    element.style.pointerEvents = 'none';
  });

  return hidden;
}

function restoreHiddenElements(hidden: HiddenElementSnapshot[]): void {
  hidden.forEach(({ element, visibility, opacity, pointerEvents }) => {
    element.style.visibility = visibility;
    element.style.opacity = opacity;
    element.style.pointerEvents = pointerEvents;
  });
}

function collectStickyElements(edge: StickyEdge): Set<HTMLElement> {
  const root = document.getElementById('designer-feedback-root');
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const y = edge === 'top' ? EDGE_OFFSET_PX : Math.max(EDGE_OFFSET_PX, viewportHeight - EDGE_OFFSET_PX);
  const elements = new Set<HTMLElement>();

  EDGE_SAMPLE_POINTS.forEach((ratio) => {
    const x = Math.min(viewportWidth - EDGE_OFFSET_PX, Math.max(EDGE_OFFSET_PX, Math.round(viewportWidth * ratio)));
    const stack = document.elementsFromPoint(x, y) as HTMLElement[];
    stack.forEach((candidate) => {
      const sticky = findStickyAncestor(candidate, edge, viewportWidth, viewportHeight, root);
      if (sticky) {
        elements.add(sticky);
      }
    });
  });

  return elements;
}

function findStickyAncestor(
  start: HTMLElement,
  edge: StickyEdge,
  viewportWidth: number,
  viewportHeight: number,
  root: HTMLElement | null
): HTMLElement | null {
  let node: HTMLElement | null = start;

  while (node && node !== document.body && node !== document.documentElement) {
    if (root && root.contains(node)) return null;

    const style = window.getComputedStyle(node);
    if (style.position === 'fixed' || style.position === 'sticky') {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > MIN_EDGE_HEIGHT_PX) {
        const wideEnough = rect.width >= viewportWidth * MIN_STICKY_WIDTH_RATIO;
        const shortEnough = rect.height <= viewportHeight * MAX_STICKY_HEIGHT_RATIO;
        if (wideEnough && shortEnough) {
          const nearTop = rect.top <= EDGE_OFFSET_PX;
          const nearBottom = rect.bottom >= viewportHeight - EDGE_OFFSET_PX;
          if ((edge === 'top' && nearTop) || (edge === 'bottom' && nearBottom)) {
            return node;
          }
        }
      }
    }

    node = node.parentElement;
  }

  return null;
}

/**
 * Stitch multiple viewport screenshots into a single full-page image
 */
async function stitchScreenshots(
  screenshots: string[],
  viewportWidth: number,
  viewportHeight: number,
  totalHeight: number,
  dpr: number,
  scrollPositions: number[]
): Promise<string> {
  const rawWidth = Math.max(1, viewportWidth * dpr);
  const rawHeight = Math.max(1, totalHeight * dpr);
  const areaScale = Math.sqrt(MAX_CANVAS_AREA / (rawWidth * rawHeight));
  const dimensionScale = Math.min(MAX_CANVAS_DIMENSION / rawWidth, MAX_CANVAS_DIMENSION / rawHeight);
  const scale = Math.min(1, areaScale, dimensionScale);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rawWidth * scale));
  canvas.height = Math.max(1, Math.round(rawHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context for stitching');
  }

  for (let i = 0; i < screenshots.length; i++) {
    const img = await loadImage(screenshots[i]);
    const scrollY = scrollPositions[i] ?? i * viewportHeight;
    const drawHeight = Math.min(viewportHeight, totalHeight - scrollY);
    const sourceHeight = Math.max(0, drawHeight * dpr);
    const destY = Math.round(scrollY * dpr * scale);
    const destHeight = Math.round(sourceHeight * scale);
    const destWidth = Math.round(img.width * scale);

    if (sourceHeight <= 0) continue;

    ctx.drawImage(img, 0, 0, img.width, sourceHeight, 0, destY, destWidth, destHeight);
  }

  return canvas.toDataURL('image/png');
}

function getDocumentSize(): { width: number; height: number } {
  const body = document.body;
  const html = document.documentElement;

  const width = Math.max(
    body?.scrollWidth ?? 0,
    body?.offsetWidth ?? 0,
    body?.clientWidth ?? 0,
    html?.scrollWidth ?? 0,
    html?.offsetWidth ?? 0,
    html?.clientWidth ?? 0,
    window.innerWidth
  );

  const height = Math.max(
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    body?.clientHeight ?? 0,
    html?.scrollHeight ?? 0,
    html?.offsetHeight ?? 0,
    html?.clientHeight ?? 0,
    window.innerHeight
  );

  return { width, height };
}

function createPlaceholderScreenshot(
  message = 'Screenshot unavailable',
  subtitle = 'Export includes annotations and layout metadata.'
): string {
  const { width, height } = getDocumentSize();
  const scale = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context for placeholder screenshot');
  }

  ctx.fillStyle = '#f4f4f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#111827';
  ctx.font = `${Math.max(12, Math.round(14 * scale))}px "Segoe UI", sans-serif`;
  ctx.fillText(message, Math.round(24 * scale), Math.round(48 * scale));
  ctx.fillStyle = '#6b7280';
  ctx.font = `${Math.max(10, Math.round(12 * scale))}px "Segoe UI", sans-serif`;
  ctx.fillText(subtitle, Math.round(24 * scale), Math.round(70 * scale));

  return canvas.toDataURL('image/png');
}
