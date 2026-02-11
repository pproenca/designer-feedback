import type {Annotation} from '@/types';
import {getCategoryConfig, CATEGORIES} from '@/shared/categories';
import {loadImage} from '@/utils/image';
import {assertDomAvailable, getDocument, getWindow} from '@/utils/dom/guards';
import {wrapText, truncateText} from '@/utils/canvas/text';
import {drawRoundedRect} from '@/utils/canvas/drawing';
import {hexToRgba} from '@/utils/canvas/color';

const SNAPSHOT_FONT_FAMILY =
  '"Space Grotesk", "Sora", "Avenir Next", "Segoe UI", sans-serif';

function formatAnnotationSummary(annotations: readonly Annotation[]): string {
  const total = annotations.length;
  const prefix = `${total} annotation${total !== 1 ? 's' : ''}`;
  const counts = new Map<string, number>();
  for (const a of annotations) {
    const config = getCategoryConfig(a.category);
    counts.set(
      config.label.toLowerCase(),
      (counts.get(config.label.toLowerCase()) ?? 0) + 1
    );
  }
  if (counts.size <= 1) return prefix;
  const parts = [...counts.entries()].map(
    ([label, count]) => `${count} ${label}${count !== 1 ? 's' : ''}`
  );
  return `${prefix} · ${parts.join(', ')}`;
}

function getMarkerRadius(index: number, baseRadius: number): number {
  const digits = String(index + 1).length;
  if (digits <= 1) return baseRadius;
  if (digits === 2) return baseRadius * 1.23;
  return baseRadius * 1.46;
}

export async function createSnapshotImage(
  screenshot: string,
  annotations: readonly Annotation[]
): Promise<string> {
  assertDomAvailable('createSnapshotImage');
  const doc = getDocument('createSnapshotImage');
  const win = getWindow('createSnapshotImage');
  const pageHeight = Math.max(
    doc.body.scrollHeight,
    doc.documentElement.scrollHeight
  );
  const pageWidth = win.innerWidth;
  const baseImage = await loadImage(screenshot);
  const scaleX = baseImage.width / pageWidth;
  const scaleY = baseImage.height / pageHeight;

  const headerHeight = 64;
  const sidebarWidth = 340;
  const headerHeightPx = Math.round(headerHeight * scaleY);
  const sidebarWidthPx = Math.round(sidebarWidth * scaleX);

  const canvas = doc.createElement('canvas');
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
  ctx.fillRect(
    baseImage.width,
    headerHeightPx,
    sidebarWidthPx,
    baseImage.height
  );

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
  const metaText = `${doc.title || 'Untitled page'} · ${exportDate} · ${formatAnnotationSummary(annotations)}`;
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
    scrollX: win.scrollX,
    scrollY: win.scrollY,
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
  annotations: readonly Annotation[],
  options: {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
    scrollX: number;
    scrollY: number;
  }
): void {
  const {offsetX, offsetY, scaleX, scaleY, scrollX, scrollY} = options;
  const baseMarkerRadius = 13 * scaleX;
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

    const annotationPoint = {
      x: annotation.isFixed ? annotation.x + scrollX : annotation.x,
      y: annotation.isFixed ? annotation.y + scrollY : annotation.y,
    };

    const point =
      Number.isFinite(annotationPoint.x) && Number.isFinite(annotationPoint.y)
        ? annotationPoint
        : bounds
          ? {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2}
          : null;

    if (!point) return;

    const x = offsetX + point.x * scaleX;
    const y = offsetY + point.y * scaleY;
    const markerRadius = getMarkerRadius(index, baseMarkerRadius);

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

type SidebarLayoutConfig = {
  headerHeight: number;
  headerPaddingX: number;
  headerPaddingY: number;
  listPadding: number;
  cardGap: number;
  cardPaddingX: number;
  cardPaddingY: number;
  indexSize: number;
  indexGap: number;
  categoryLineHeight: number;
  elementLineHeight: number;
  commentLineHeight: number;
  commentFont: string;
  headerFont: string;
  labelFont: string;
  titleFont: string;
  indexFont: string;
  overflowFont: string;
  borderWidth: number;
  cardRadius: number;
  categoryDotRadius: number;
  categoryDotGap: number;
};

function createSidebarLayout(scale: number): SidebarLayoutConfig {
  return {
    headerHeight: 72 * scale,
    headerPaddingX: 18 * scale,
    headerPaddingY: 16 * scale,
    listPadding: 14 * scale,
    cardGap: 10 * scale,
    cardPaddingX: 14 * scale,
    cardPaddingY: 12 * scale,
    indexSize: 26 * scale,
    indexGap: 12 * scale,
    categoryLineHeight: 12 * scale,
    elementLineHeight: 16 * scale,
    commentLineHeight: 18 * scale,
    commentFont: `500 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`,
    headerFont: `600 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`,
    labelFont: `600 ${10 * scale}px ${SNAPSHOT_FONT_FAMILY}`,
    titleFont: `600 ${13 * scale}px ${SNAPSHOT_FONT_FAMILY}`,
    indexFont: `600 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`,
    overflowFont: `400 ${12 * scale}px ${SNAPSHOT_FONT_FAMILY}`,
    borderWidth: Math.max(1, scale),
    cardRadius: 14 * scale,
    categoryDotRadius: 3 * scale,
    categoryDotGap: 12 * scale,
  };
}

function drawSidebarPanel(
  ctx: CanvasRenderingContext2D,
  annotations: readonly Annotation[],
  options: {x: number; y: number; width: number; height: number; scale: number}
): void {
  const {x, y, width, height, scale} = options;
  const L = createSidebarLayout(scale);

  drawSidebarHeader(ctx, annotations.length, {x, y, width}, L);

  let cursorY = y + L.headerHeight + L.listPadding;
  const maxY = y + height - L.listPadding;
  const cardX = x + L.listPadding;
  const cardWidth = width - L.listPadding * 2;
  const textWidth = cardWidth - L.cardPaddingX * 2 - L.indexSize - L.indexGap;

  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    const config = getCategoryConfig(annotation.category);

    ctx.font = L.commentFont;
    const cardLayout = calculateCardLayout(ctx, {
      annotation,
      textWidth,
      cursorY,
      maxY,
      scale,
      layout: L,
    });

    if (cardLayout.overflow) {
      drawOverflowIndicator(ctx, annotations.length - i, {
        x: cardX,
        y: cursorY,
        font: L.overflowFont,
      });
      break;
    }

    drawAnnotationCard(ctx, {
      annotation,
      config,
      index: i,
      cardX,
      cardWidth,
      cursorY,
      cardHeight: cardLayout.cardHeight,
      commentLines: cardLayout.commentLines,
      textWidth,
      scale,
      layout: L,
    });

    cursorY += cardLayout.cardHeight + L.cardGap;
  }
}

function drawSidebarHeader(
  ctx: CanvasRenderingContext2D,
  count: number,
  area: {x: number; y: number; width: number},
  L: SidebarLayoutConfig
): void {
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = L.headerFont;
  ctx.fillText(
    `Annotations (${count})`,
    area.x + L.headerPaddingX,
    area.y + L.headerPaddingY
  );

  // Category legend (2x2 grid)
  const legendY =
    area.y + L.headerPaddingY + L.categoryLineHeight + 8 * L.categoryDotRadius;
  const legendX = area.x + L.headerPaddingX;
  const colWidth = (area.width - L.headerPaddingX * 2) / 2;
  const legendRowHeight = L.categoryLineHeight + 2 * L.categoryDotRadius;
  ctx.font = L.labelFont;

  CATEGORIES.forEach((cat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = legendX + col * colWidth;
    const cy = legendY + row * legendRowHeight;

    ctx.beginPath();
    ctx.fillStyle = cat.color;
    ctx.arc(
      cx + L.categoryDotRadius,
      cy + L.categoryLineHeight / 2,
      L.categoryDotRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(cat.label, cx + L.categoryDotGap, cy);
  });

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = L.borderWidth;
  ctx.beginPath();
  ctx.moveTo(area.x, area.y + L.headerHeight);
  ctx.lineTo(area.x + area.width, area.y + L.headerHeight);
  ctx.stroke();
  ctx.restore();
}

type CardLayoutInput = {
  annotation: Annotation;
  textWidth: number;
  cursorY: number;
  maxY: number;
  scale: number;
  layout: SidebarLayoutConfig;
};

type CardLayoutResult = {
  cardHeight: number;
  commentLines: string[];
  overflow: boolean;
};

function calculateCardLayout(
  ctx: CanvasRenderingContext2D,
  input: CardLayoutInput
): CardLayoutResult {
  const {annotation, textWidth, cursorY, maxY, scale, layout: L} = input;
  const baseContentHeight =
    L.categoryLineHeight + 6 * scale + L.elementLineHeight + 4 * scale;
  const minCardHeight =
    L.cardPaddingY * 2 + Math.max(L.indexSize, baseContentHeight);

  if (cursorY + minCardHeight > maxY) {
    return {cardHeight: 0, commentLines: [], overflow: true};
  }

  let commentLines = wrapText(ctx, annotation.comment, textWidth);
  const maxContentHeight = maxY - cursorY - L.cardPaddingY * 2;
  const maxCommentLines = Math.max(
    0,
    Math.floor((maxContentHeight - baseContentHeight) / L.commentLineHeight)
  );

  if (maxCommentLines === 0) {
    commentLines = [];
  } else if (commentLines.length > maxCommentLines) {
    commentLines = commentLines.slice(0, maxCommentLines);
    const lastIndex = commentLines.length - 1;
    commentLines[lastIndex] = truncateText(
      ctx,
      `${commentLines[lastIndex]}…`,
      textWidth
    );
  }

  const contentHeight =
    baseContentHeight + commentLines.length * L.commentLineHeight;
  const cardHeight = L.cardPaddingY * 2 + Math.max(L.indexSize, contentHeight);

  if (cursorY + cardHeight > maxY) {
    return {cardHeight: 0, commentLines: [], overflow: true};
  }

  return {cardHeight, commentLines, overflow: false};
}

function drawOverflowIndicator(
  ctx: CanvasRenderingContext2D,
  remaining: number,
  position: {x: number; y: number; font: string}
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = position.font;
  ctx.textBaseline = 'top';
  ctx.fillText(`… and ${remaining} more`, position.x, position.y);
  ctx.restore();
}

function drawAnnotationCard(
  ctx: CanvasRenderingContext2D,
  opts: {
    annotation: Annotation;
    config: {color: string; label: string};
    index: number;
    cardX: number;
    cardWidth: number;
    cursorY: number;
    cardHeight: number;
    commentLines: string[];
    textWidth: number;
    scale: number;
    layout: SidebarLayoutConfig;
  }
): void {
  const {
    annotation,
    config,
    index,
    cardX,
    cardWidth,
    cursorY,
    cardHeight,
    commentLines,
    textWidth,
    scale,
    layout: L,
  } = opts;

  // Card background + border
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = L.borderWidth;
  drawRoundedRect(ctx, cardX, cursorY, cardWidth, cardHeight, L.cardRadius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Category-colored left accent border
  const accentWidth = 3 * L.borderWidth;
  ctx.save();
  ctx.beginPath();
  drawRoundedRect(ctx, cardX, cursorY, cardWidth, cardHeight, L.cardRadius);
  ctx.clip();
  ctx.fillStyle = config.color;
  ctx.fillRect(cardX, cursorY, accentWidth, cardHeight);
  ctx.restore();

  const indexCenterX = cardX + L.cardPaddingX + L.indexSize / 2;
  const indexCenterY = cursorY + L.cardPaddingY + L.indexSize / 2;

  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = config.color;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 10 * scale;
  ctx.shadowOffsetY = 3 * scale;
  ctx.arc(indexCenterX, indexCenterY, L.indexSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = L.indexFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), indexCenterX, indexCenterY);
  ctx.restore();

  const textX = cardX + L.cardPaddingX + L.indexSize + L.indexGap;
  let textY = cursorY + L.cardPaddingY;

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = L.labelFont;
  ctx.textBaseline = 'top';
  ctx.beginPath();
  ctx.arc(
    textX + L.categoryDotRadius,
    textY + L.categoryLineHeight / 2,
    L.categoryDotRadius,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = config.color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(config.label.toUpperCase(), textX + L.categoryDotGap, textY);
  ctx.restore();

  textY += L.categoryLineHeight + 6 * scale;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = L.titleFont;
  ctx.textBaseline = 'top';
  ctx.fillText(truncateText(ctx, annotation.element, textWidth), textX, textY);
  ctx.restore();

  textY += L.elementLineHeight + 4 * scale;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.76)';
  ctx.font = L.commentFont;
  ctx.textBaseline = 'top';
  commentLines.forEach(line => {
    ctx.fillText(line, textX, textY);
    textY += L.commentLineHeight;
  });
  ctx.restore();
}
