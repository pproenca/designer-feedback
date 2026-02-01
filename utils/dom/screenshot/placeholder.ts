import {assertDomAvailable} from '@/utils/dom/guards';

function getDocumentSize(): {width: number; height: number} {
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

  return {width, height};
}

export function createPlaceholderScreenshot(
  message = 'Screenshot unavailable',
  subtitle = 'Export includes annotations and layout metadata.'
): string {
  assertDomAvailable('createPlaceholderScreenshot');
  const {width, height} = getDocumentSize();
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
