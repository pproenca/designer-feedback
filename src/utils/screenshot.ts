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
 * Crop a screenshot to a specific region
 */
export async function cropScreenshot(
  fullScreenshot: string,
  bounds: { x: number; y: number; width: number; height: number },
  padding = 20
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Account for device pixel ratio
      const dpr = window.devicePixelRatio || 1;

      // Calculate crop region with padding
      const x = Math.max(0, (bounds.x - padding) * dpr);
      const y = Math.max(0, (bounds.y - padding) * dpr);
      const width = Math.min(img.width - x, (bounds.width + padding * 2) * dpr);
      const height = Math.min(img.height - y, (bounds.height + padding * 2) * dpr);

      // Create canvas for cropping
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw cropped region
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

      // Convert to data URL
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load screenshot for cropping'));
    };

    img.src = fullScreenshot;
  });
}

/**
 * Get element bounds relative to viewport
 */
export function getElementBounds(element: HTMLElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}
