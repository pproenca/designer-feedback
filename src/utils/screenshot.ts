// =============================================================================
// Screenshot Utilities
// =============================================================================

/**
 * Capture the visible tab screenshot via the background service worker
 */
export async function captureScreenshot(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Message channel error'));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      if (response?.data) {
        resolve(response.data);
      } else {
        reject(new Error('Failed to capture screenshot'));
      }
    });
  });
}

/**
 * Capture full page by scrolling through the document and stitching screenshots
 */
export async function captureFullPage(): Promise<string> {
  try {
    return await captureFullPageFromExtension();
  } catch (error) {
    console.warn('Extension screenshot capture failed, using placeholder.', error);
    return createPlaceholderScreenshot();
  }
}

async function captureFullPageFromExtension(): Promise<string> {
  // Save original scroll position
  const originalScrollY = window.scrollY;

  // Get document dimensions
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
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
      await new Promise((resolve) => setTimeout(resolve, 100));

      const screenshot = await captureScreenshot();
      screenshots.push(screenshot);
    }
  } finally {
    // Restore scroll position
    window.scrollTo(0, originalScrollY);
  }

  // Stitch screenshots on canvas
  return stitchScreenshots(
    screenshots,
    viewportWidth,
    viewportHeight,
    docHeight,
    dpr,
    scrollPositions
  );
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
  const canvas = document.createElement('canvas');
  canvas.width = viewportWidth * dpr;
  canvas.height = totalHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context for stitching');
  }

  for (let i = 0; i < screenshots.length; i++) {
    const img = await loadImage(screenshots[i]);
    const scrollY = scrollPositions[i] ?? i * viewportHeight;
    const drawHeight = Math.min(viewportHeight, totalHeight - scrollY);
    const sourceHeight = Math.max(0, drawHeight * dpr);
    const destY = scrollY * dpr;

    if (sourceHeight <= 0) continue;

    ctx.drawImage(
      img,
      0,
      0,
      img.width,
      sourceHeight,
      0,
      destY,
      img.width,
      sourceHeight
    );
  }

  return canvas.toDataURL('image/png');
}

/**
 * Load an image from a data URL
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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

function createPlaceholderScreenshot(): string {
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
  ctx.fillText('Screenshot unavailable', Math.round(24 * scale), Math.round(48 * scale));
  ctx.fillStyle = '#6b7280';
  ctx.font = `${Math.max(10, Math.round(12 * scale))}px "Segoe UI", sans-serif`;
  ctx.fillText('Export includes annotations and layout metadata.', Math.round(24 * scale), Math.round(70 * scale));

  return canvas.toDataURL('image/png');
}
