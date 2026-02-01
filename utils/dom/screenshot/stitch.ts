import {loadImage} from '@/utils/image';
import {assertDomAvailable} from '@/utils/dom/guards';

const MAX_CANVAS_DIMENSION = 16384;
const MAX_CANVAS_AREA = 268_000_000;

export async function stitchScreenshots(
  screenshots: string[],
  viewportWidth: number,
  viewportHeight: number,
  totalHeight: number,
  dpr: number,
  scrollPositions: number[]
): Promise<string> {
  assertDomAvailable('stitchScreenshots');
  const rawWidth = Math.max(1, viewportWidth * dpr);
  const rawHeight = Math.max(1, totalHeight * dpr);
  const areaScale = Math.sqrt(MAX_CANVAS_AREA / (rawWidth * rawHeight));
  const dimensionScale = Math.min(
    MAX_CANVAS_DIMENSION / rawWidth,
    MAX_CANVAS_DIMENSION / rawHeight
  );
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

    ctx.drawImage(
      img,
      0,
      0,
      img.width,
      sourceHeight,
      0,
      destY,
      destWidth,
      destHeight
    );
  }

  return canvas.toDataURL('image/png');
}
