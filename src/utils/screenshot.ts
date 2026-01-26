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

  // Calculate number of captures needed
  const numCaptures = Math.ceil(docHeight / viewportHeight);
  const screenshots: string[] = [];

  // Capture each viewport section
  for (let i = 0; i < numCaptures; i++) {
    const scrollY = i * viewportHeight;
    window.scrollTo(0, scrollY);

    // Wait for render
    await new Promise((resolve) => setTimeout(resolve, 100));

    const screenshot = await captureScreenshot();
    screenshots.push(screenshot);
  }

  // Restore scroll position
  window.scrollTo(0, originalScrollY);

  // Stitch screenshots on canvas
  return stitchScreenshots(screenshots, viewportWidth, viewportHeight, docHeight, dpr);
}

/**
 * Stitch multiple viewport screenshots into a single full-page image
 */
async function stitchScreenshots(
  screenshots: string[],
  viewportWidth: number,
  viewportHeight: number,
  totalHeight: number,
  dpr: number
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
    const y = i * viewportHeight * dpr;

    // For the last image, only draw the remaining portion
    const isLast = i === screenshots.length - 1;
    const remainingHeight = totalHeight - i * viewportHeight;
    const drawHeight = isLast ? remainingHeight * dpr : viewportHeight * dpr;

    ctx.drawImage(
      img,
      0,
      0,
      img.width,
      drawHeight, // source
      0,
      y,
      img.width,
      drawHeight // destination
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
