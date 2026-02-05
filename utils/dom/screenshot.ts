import {createPlaceholderScreenshot} from './screenshot/placeholder';
import {hideStickyElements, restoreHiddenElements} from './screenshot/sticky';
import {stitchScreenshots} from './screenshot/stitch';
import {
  backgroundMessenger,
  withTimeout,
  type CaptureScreenshotErrorCode,
} from '@/utils/messaging';
import {assertDomAvailable} from '@/utils/dom/guards';

export type FullPageCaptureResult = {
  dataUrl: string;
  isPlaceholder: boolean;
  mode: 'full' | 'viewport' | 'placeholder';
  error?: string;
};

export class ActiveTabRequiredError extends Error {
  constructor(message = 'Active tab permission required') {
    super(message);
    this.name = 'ActiveTabRequiredError';
  }
}

export class CaptureRateLimitedError extends Error {
  constructor(message = 'Screenshot capture is rate-limited') {
    super(message);
    this.name = 'CaptureRateLimitedError';
  }
}

export function isActiveTabRequiredError(
  error: unknown
): error is ActiveTabRequiredError {
  return error instanceof ActiveTabRequiredError;
}

export function isCaptureRateLimitedError(
  error: unknown
): error is CaptureRateLimitedError {
  return error instanceof CaptureRateLimitedError;
}

function isActiveTabErrorCode(
  code: CaptureScreenshotErrorCode | undefined
): boolean {
  return code === 'activeTab-required';
}

function isCaptureRateLimitCode(
  code: CaptureScreenshotErrorCode | undefined
): boolean {
  return code === 'capture-rate-limited';
}

export function isRestrictedPage(): boolean {
  assertDomAvailable('isRestrictedPage');
  try {
    const protocol = window.location.protocol;

    return protocol !== 'http:' && protocol !== 'https:';
  } catch {
    return true;
  }
}

export async function captureScreenshot(): Promise<string> {
  const response = await withTimeout(
    backgroundMessenger.sendMessage('captureScreenshot', undefined)
  );

  if (isActiveTabErrorCode(response.errorCode)) {
    throw new ActiveTabRequiredError(response.error ?? undefined);
  }

  if (isCaptureRateLimitCode(response.errorCode)) {
    throw new CaptureRateLimitedError(response.error ?? undefined);
  }

  if (response.error) {
    throw new Error(response.error);
  }

  if (response.data && response.data.length > 0) {
    return response.data;
  }
  throw new Error('Failed to capture screenshot: empty response');
}

export async function captureFullPage(): Promise<FullPageCaptureResult> {
  assertDomAvailable('captureFullPage');
  const isE2E = import.meta.env.VITE_DF_E2E === '1';
  if (isE2E) {
    return {
      dataUrl: createPlaceholderScreenshot(),
      isPlaceholder: false,
      mode: 'full',
    };
  }
  try {
    return {
      dataUrl: await captureFullPageFromExtension(),
      isPlaceholder: false,
      mode: 'full',
    };
  } catch (error) {
    if (isActiveTabRequiredError(error)) {
      throw error;
    }
    console.warn(
      'Extension screenshot capture failed, using placeholder.',
      error
    );
    try {
      const fallback = await captureScreenshotWithRetry();
      return {
        dataUrl: fallback,
        isPlaceholder: false,
        mode: 'viewport',
        error: error instanceof Error ? error.message : String(error),
      };
    } catch (fallbackError) {
      console.warn(
        'Viewport screenshot capture failed, using placeholder.',
        fallbackError
      );
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
    await new Promise(resolve => setTimeout(resolve, wait));
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
  if (isCaptureRateLimitedError(error)) return true;
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('max_capture_visible_tab_calls_per_second') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many calls')
  );
}

async function captureScreenshotWithRetry(
  retries: number = CAPTURE_RETRY_COUNT
): Promise<string> {
  try {
    return await captureScreenshotThrottled();
  } catch (error) {
    if (isActiveTabRequiredError(error)) {
      throw error;
    }
    if (retries <= 0) {
      throw error;
    }
    const delay = isRateLimitError(error)
      ? RATE_LIMIT_BACKOFF_MS
      : CAPTURE_RETRY_DELAY_MS;
    await new Promise(resolve => setTimeout(resolve, delay));
    return captureScreenshotWithRetry(retries - 1);
  }
}

async function captureFullPageFromExtension(): Promise<string> {
  const originalScrollY = window.scrollY;

  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const maxScrollY = Math.max(0, docHeight - viewportHeight);

  const numCaptures = Math.max(1, Math.ceil(docHeight / viewportHeight));
  const screenshots: string[] = [];
  const scrollPositions: number[] = [];

  try {
    for (let i = 0; i < numCaptures; i++) {
      const scrollY = Math.min(i * viewportHeight, maxScrollY);
      scrollPositions.push(scrollY);
      window.scrollTo(0, scrollY);

      await new Promise(resolve => {
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
    window.scrollTo(0, originalScrollY);
  }

  return stitchScreenshots(
    screenshots,
    viewportWidth,
    viewportHeight,
    docHeight,
    dpr,
    scrollPositions
  );
}
