// =============================================================================
// Export Utilities
// =============================================================================

import type { Annotation, FeedbackExport } from '@/types';
import { getCategoryConfig } from '@/shared/categories';
import { sendMessage } from '@/utils/messaging';
import { captureFullPage } from './screenshot';

/**
 * Generate JSON export object
 */
export function generateJSONExport(annotations: Annotation[]): FeedbackExport {
  const screenshots: Record<string, string> = {};

  annotations.forEach((annotation) => {
    if (annotation.screenshot) {
      screenshots[annotation.id] = annotation.screenshot;
    }
  });

  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    page: {
      url: window.location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    },
    annotations: annotations.map((a) => ({
      ...a,
      screenshot: '', // Screenshots are stored separately
    })),
    screenshots,
  };
}

/**
 * Generate Markdown export
 */
export function generateMarkdownExport(annotations: Annotation[]): string {
  const lines: string[] = [];

  // Header
  lines.push('# Design Feedback Report');
  lines.push('');
  lines.push(`**Page:** ${document.title}`);
  lines.push(`**URL:** ${window.location.href}`);
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| # | Category | Element | Comment |');
  lines.push('|---|----------|---------|---------|');

  annotations.forEach((annotation, index) => {
    const category = getCategoryConfig(annotation.category);
    const comment = annotation.comment.replace(/\|/g, '\\|').slice(0, 50);
    const element = annotation.element.replace(/\|/g, '\\|').slice(0, 30);
    lines.push(
      `| ${index + 1} | ${category.emoji} ${category.label} | ${element} | ${comment}${
        annotation.comment.length > 50 ? '...' : ''
      } |`
    );
  });

  lines.push('');

  // Agent steps
  lines.push('## Agent Steps');
  lines.push('');
  lines.push('1. Review the summary and annotations, mapping each item to the relevant code area.');
  lines.push('2. Triage by category (bugs/accessibility first), then implement fixes in order.');
  lines.push('3. Validate the UI against annotated elements and update tests if needed.');
  lines.push('4. Report status for each annotation number and flag open questions.');
  lines.push('');

  // Detailed annotations
  lines.push('## Detailed Annotations');
  lines.push('');

  annotations.forEach((annotation, index) => {
    const category = getCategoryConfig(annotation.category);
    lines.push(`### ${index + 1}. ${category.emoji} ${category.label}: ${annotation.element}`);
    lines.push('');
    lines.push(`**Comment:** ${annotation.comment}`);
    lines.push('');
    if (annotation.elementPath) {
      lines.push(`**Element Path:** \`${annotation.elementPath}\``);
      lines.push('');
    }
    lines.push(`![Screenshot](./screenshots/${index + 1}.png)`);
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

type DownloadResponse = { ok: boolean; error?: string };

function canUseBackgroundDownload(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);
}

async function requestBackgroundDownload(dataUrl: string, filename: string): Promise<void> {
  const response = await sendMessage<DownloadResponse>({
    type: 'DOWNLOAD_FILE',
    filename,
    dataUrl,
  });
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Download failed');
  }
}

function triggerAnchorDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  (document.body ?? document.documentElement).appendChild(link);
  link.click();
  link.remove();
}

export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  if (canUseBackgroundDownload()) {
    try {
      await requestBackgroundDownload(dataUrl, filename);
      return;
    } catch (error) {
      console.warn('Background download failed, falling back to anchor download.', error);
    }
  }

  triggerAnchorDownload(dataUrl, filename);
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Clipboard copy failed');
  }
}

/**
 * Hide extension UI before screenshot capture
 */
function hideExtensionUI(): void {
  document.dispatchEvent(new CustomEvent('designer-feedback:hide-ui'));
}

/**
 * Show extension UI after screenshot capture
 */
function showExtensionUI(): void {
  document.dispatchEvent(new CustomEvent('designer-feedback:show-ui'));
}

/**
 * Export full-page snapshot with markers + details sidebar to clipboard
 */
export async function exportAsSnapshotImage(annotations: Annotation[]): Promise<void> {
  // Hide UI before capture
  hideExtensionUI();

  // Small delay to ensure UI is hidden and repaint occurs
  await new Promise((resolve) => setTimeout(resolve, 50));

  let screenshot: string;
  try {
    screenshot = await captureFullPage();
  } finally {
    showExtensionUI();
  }

  const composite = await createSnapshotImage(screenshot, annotations);
  const timestamp = new Date().toISOString().split('T')[0];
  await downloadDataUrl(composite, `feedback-${timestamp}.png`);
}

/**
 * Export markdown notes to clipboard
 */
export async function exportAsImageWithNotes(annotations: Annotation[]): Promise<void> {
  const markdown = generateNotesMarkdown(annotations);
  await copyToClipboard(markdown);
}

/**
 * Generate markdown notes for image export
 */
function generateNotesMarkdown(annotations: Annotation[]): string {
  const lines: string[] = [];

  // Header
  lines.push('# Feedback Notes');
  lines.push('');
  lines.push(`**Page:** ${document.title}`);
  lines.push(`**URL:** ${window.location.href}`);
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Agent Steps');
  lines.push('');
  lines.push('1. Review the annotations and map each item to the relevant code area.');
  lines.push('2. Triage by category (bugs/accessibility first), then implement fixes in order.');
  lines.push('3. Validate the UI against annotated elements and update tests if needed.');
  lines.push('4. Report status for each annotation number and flag open questions.');
  lines.push('');
  lines.push('## Annotations');
  lines.push('');

  // Annotations
  annotations.forEach((annotation, index) => {
    const config = getCategoryConfig(annotation.category);
    lines.push(`### ${index + 1}. ${config.emoji} ${config.label} - ${annotation.element}`);
    lines.push('');
    lines.push(annotation.comment);
    lines.push('');
    if (annotation.elementPath) {
      lines.push(`*Element:* \`${annotation.elementPath}\``);
      lines.push('');
    }
  });

  return lines.join('\n');
}

const SNAPSHOT_FONT_FAMILY =
  '"Space Grotesk", "Sora", "Avenir Next", "Segoe UI", sans-serif';

async function createSnapshotImage(
  screenshot: string,
  annotations: Annotation[]
): Promise<string> {
  const pageHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const pageWidth = window.innerWidth;
  const baseImage = await loadImage(screenshot);
  const scaleX = baseImage.width / pageWidth;
  const scaleY = baseImage.height / pageHeight;

  const headerHeight = 64;
  const sidebarWidth = 340;
  const headerHeightPx = Math.round(headerHeight * scaleY);
  const sidebarWidthPx = Math.round(sidebarWidth * scaleX);

  const canvas = document.createElement('canvas');
  canvas.width = baseImage.width + sidebarWidthPx;
  canvas.height = baseImage.height + headerHeightPx;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context for snapshot export');
  }

  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(18, 18, 18, 0.96)';
  ctx.fillRect(0, 0, canvas.width, headerHeightPx);

  ctx.drawImage(baseImage, 0, headerHeightPx);

  ctx.fillStyle = '#141414';
  ctx.fillRect(baseImage.width, headerHeightPx, sidebarWidthPx, baseImage.height);

  const borderWidth = Math.max(1, Math.round(scaleX));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = borderWidth;
  ctx.beginPath();
  ctx.moveTo(0, headerHeightPx);
  ctx.lineTo(canvas.width, headerHeightPx);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(baseImage.width, headerHeightPx);
  ctx.lineTo(baseImage.width, canvas.height);
  ctx.stroke();

  const exportDate = new Date().toLocaleString();
  const headerPaddingX = 18 * scaleX;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#f5f5f7';
  ctx.font = `600 ${15 * scaleY}px ${SNAPSHOT_FONT_FAMILY}`;
  ctx.fillText('Feedback Export', headerPaddingX, 16 * scaleY);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `400 ${11 * scaleY}px ${SNAPSHOT_FONT_FAMILY}`;
  const metaText = `${document.title || 'Untitled page'} · ${exportDate} · ${
    annotations.length
  } annotation${annotations.length !== 1 ? 's' : ''}`;
  ctx.fillText(
    truncateText(ctx, metaText, canvas.width - headerPaddingX * 2),
    headerPaddingX,
    36 * scaleY
  );

  drawAnnotationOverlays(ctx, annotations, {
    offsetX: 0,
    offsetY: headerHeightPx,
    scaleX,
    scaleY,
  });

  drawSidebarPanel(ctx, annotations, {
    x: baseImage.width,
    y: headerHeightPx,
    width: sidebarWidthPx,
    height: baseImage.height,
    scale: scaleX,
  });

  return canvas.toDataURL('image/png');
}

function drawAnnotationOverlays(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  options: { offsetX: number; offsetY: number; scaleX: number; scaleY: number }
): void {
  const { offsetX, offsetY, scaleX, scaleY } = options;
  const markerRadius = 13 * scaleX;
  const markerFontSize = 12 * scaleX;
  const strokeWidth = Math.max(1, 2 * scaleX);

  annotations.forEach((annotation, index) => {
    const config = getCategoryConfig(annotation.category);
    const bounds = annotation.boundingBox ?? annotation.screenshotBounds;

    if (bounds && bounds.width > 1 && bounds.height > 1) {
      const rectX = offsetX + bounds.x * scaleX;
      const rectY = offsetY + bounds.y * scaleY;
      const rectW = bounds.width * scaleX;
      const rectH = bounds.height * scaleY;
      const radius = Math.min(12 * scaleX, rectW / 2, rectH / 2);

      ctx.save();
      ctx.fillStyle = hexToRgba(config.color, 0.22);
      ctx.strokeStyle = hexToRgba(config.color, 0.85);
      ctx.lineWidth = strokeWidth;
      drawRoundedRect(ctx, rectX, rectY, rectW, rectH, radius);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const point = bounds
      ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
      : {
          x: annotation.isFixed ? annotation.x + window.scrollX : annotation.x,
          y: annotation.isFixed ? annotation.y + window.scrollY : annotation.y,
        };

    const x = offsetX + point.x * scaleX;
    const y = offsetY + point.y * scaleY;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = config.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12 * scaleX;
    ctx.shadowOffsetY = 4 * scaleY;
    ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${markerFontSize}px ${SNAPSHOT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), x, y);
    ctx.restore();
  });
}

function drawSidebarPanel(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  options: { x: number; y: number; width: number; height: number; scale: number }
): void {
  const { x, y, width, height, scale } = options;
  const headerHeight = 48 * scale;
  const headerPaddingX = 18 * scale;
  const headerPaddingY = 16 * scale;
  const listPadding = 14 * scale;
  const cardGap = 10 * scale;
  const cardPaddingX = 14 * scale;
  const cardPaddingY = 12 * scale;
  const indexSize = 26 * scale;
  const indexGap = 12 * scale;
  const categoryLineHeight = 12 * scale;
  const elementLineHeight = 16 * scale;
  const commentLineHeight = 16 * scale;

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = `600 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`;
  ctx.fillText(`Annotations (${annotations.length})`, x + headerPaddingX, y + headerPaddingY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = Math.max(1, scale);
  ctx.beginPath();
  ctx.moveTo(x, y + headerHeight);
  ctx.lineTo(x + width, y + headerHeight);
  ctx.stroke();
  ctx.restore();

  let cursorY = y + headerHeight + listPadding;
  const maxY = y + height - listPadding;
  const cardX = x + listPadding;
  const cardWidth = width - listPadding * 2;
  const textWidth = cardWidth - cardPaddingX * 2 - indexSize - indexGap;

  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    const config = getCategoryConfig(annotation.category);

    ctx.font = `400 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`;
    let commentLines = wrapText(ctx, annotation.comment, textWidth);
    if (commentLines.length > 2) {
      commentLines = commentLines.slice(0, 2);
      commentLines[1] = truncateText(ctx, `${commentLines[1]}…`, textWidth);
    }

    const contentHeight =
      categoryLineHeight +
      6 * scale +
      elementLineHeight +
      4 * scale +
      commentLines.length * commentLineHeight;
    const cardHeight = cardPaddingY * 2 + Math.max(indexSize, contentHeight);

    if (cursorY + cardHeight > maxY) {
      const remaining = annotations.length - i;
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = `400 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`;
      ctx.textBaseline = 'top';
      ctx.fillText(`… and ${remaining} more`, cardX, cursorY);
      ctx.restore();
      break;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = Math.max(1, scale);
    drawRoundedRect(ctx, cardX, cursorY, cardWidth, cardHeight, 14 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const indexCenterX = cardX + cardPaddingX + indexSize / 2;
    const indexCenterY = cursorY + cardPaddingY + indexSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = config.color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetY = 3 * scale;
    ctx.arc(indexCenterX, indexCenterY, indexSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), indexCenterX, indexCenterY);
    ctx.restore();

    const textX = cardX + cardPaddingX + indexSize + indexGap;
    let textY = cursorY + cardPaddingY;

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `600 ${10 * scale}px ${SNAPSHOT_FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    ctx.beginPath();
    ctx.arc(textX + 3 * scale, textY + categoryLineHeight / 2, 3 * scale, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(config.label.toUpperCase(), textX + 12 * scale, textY);
    ctx.restore();

    textY += categoryLineHeight + 6 * scale;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${13 * scale}px ${SNAPSHOT_FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    ctx.fillText(truncateText(ctx, annotation.element, textWidth), textX, textY);
    ctx.restore();

    textY += elementLineHeight + 4 * scale;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `400 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    commentLines.forEach((line) => {
      ctx.fillText(line, textX, textY);
      textY += commentLineHeight;
    });
    ctx.restore();

    cursorY += cardHeight + cardGap;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? `${trimmed}…` : '';
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int) || value.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
