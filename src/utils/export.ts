// =============================================================================
// Export Utilities
// =============================================================================

import JSZip from 'jszip';
import type { Annotation, FeedbackExport, FeedbackCategory } from '@/types';
import { getCategoryConfig, CATEGORIES } from '@/shared/categories';
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

/**
 * Generate category summary for markdown
 */
export function getCategorySummary(
  annotations: Annotation[]
): Record<FeedbackCategory, number> {
  const summary: Record<FeedbackCategory, number> = {
    bug: 0,
    suggestion: 0,
    question: 0,
    accessibility: 0,
  };

  annotations.forEach((annotation) => {
    summary[annotation.category]++;
  });

  return summary;
}

/**
 * Create ZIP file with all export data
 */
export async function createExportZip(annotations: Annotation[]): Promise<Blob> {
  const zip = new JSZip();
  const timestamp = new Date().toISOString().split('T')[0];
  const folderName = `feedback-${timestamp}`;
  const folder = zip.folder(folderName)!;

  // Add JSON export
  const jsonExport = generateJSONExport(annotations);
  folder.file('feedback.json', JSON.stringify(jsonExport, null, 2));

  // Add Markdown export
  const markdownExport = generateMarkdownExport(annotations);
  folder.file('feedback.md', markdownExport);

  // Add screenshots folder
  const screenshotsFolder = folder.folder('screenshots')!;
  annotations.forEach((annotation, index) => {
    if (annotation.screenshot) {
      // Convert base64 data URL to binary
      const base64Data = annotation.screenshot.split(',')[1];
      screenshotsFolder.file(`${index + 1}.png`, base64Data, { base64: true });
    }
  });

  // Generate ZIP blob
  return zip.generateAsync({ type: 'blob' });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download feedback as ZIP (legacy)
 */
export async function exportFeedback(annotations: Annotation[]): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const blob = await createExportZip(annotations);
  downloadBlob(blob, `feedback-${timestamp}.zip`);
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
 * Generate interactive HTML export with screenshot background and hoverable markers
 */
export async function exportAsHTML(annotations: Annotation[]): Promise<void> {
  // Hide UI before capture
  hideExtensionUI();

  // Small delay to ensure UI is hidden and repaint occurs
  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    // Capture full page screenshot
    const screenshot = await captureFullPage();

    // Generate HTML with embedded styles (coordinates are absolute document positions)
    const html = generateInteractiveHTML(annotations, screenshot);

    // Create blob and download
    const blob = new Blob([html], { type: 'text/html' });
    const timestamp = new Date().toISOString().split('T')[0];
    downloadBlob(blob, `feedback-${timestamp}.html`);
  } finally {
    showExtensionUI();
  }
}

/**
 * Generate self-contained interactive HTML
 */
function generateInteractiveHTML(annotations: Annotation[], screenshot: string): string {
  const pageTitle = document.title || 'Feedback Report';
  const pageUrl = window.location.href;
  const exportDate = new Date().toLocaleString();
  const pageHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  const pageWidth = window.innerWidth;

  // Generate category CSS variables
  const categoryStyles = CATEGORIES.map(
    (c) => `    --color-${c.id}: ${c.color};`
  ).join('\n');

  const getAnnotationPoint = (
    annotation: Annotation,
    bounds?: { x: number; y: number; width: number; height: number }
  ) => {
    if (bounds) {
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    }
    const baseX = annotation.isFixed ? annotation.x + window.scrollX : annotation.x;
    const baseY = annotation.isFixed ? annotation.y + window.scrollY : annotation.y;
    return { x: baseX, y: baseY };
  };

  // Generate markers HTML - use absolute document positions directly
  const markersHTML = annotations
    .map((annotation, index) => {
      const config = getCategoryConfig(annotation.category);
      const bounds = annotation.boundingBox ?? annotation.screenshotBounds;
      const { x: leftPx, y: topPx } = getAnnotationPoint(annotation, bounds);
      const boundsAttrs = bounds
        ? `data-bx="${bounds.x}" data-by="${bounds.y}" data-bw="${bounds.width}" data-bh="${bounds.height}"`
        : '';
      const ariaLabel = escapeHtml(
        `Annotation ${index + 1}: ${config.label} - ${annotation.element}`
      );

      return `
    <div class="marker" role="button" tabindex="0" aria-pressed="false" aria-label="${ariaLabel}" style="left: ${leftPx}px; top: ${topPx}px; background-color: ${config.color};" data-index="${index}" ${boundsAttrs}>
      ${index + 1}
      <div class="tooltip">
        <div class="tooltip-category">
          <span class="tooltip-dot" style="background-color: ${config.color};"></span>
          ${config.label}
        </div>
        <div class="tooltip-element">${escapeHtml(annotation.element)}</div>
        <div class="tooltip-comment">${escapeHtml(annotation.comment)}</div>
        ${annotation.elementPath ? `<div class="tooltip-path">${escapeHtml(annotation.elementPath)}</div>` : ''}
      </div>
    </div>`;
    })
    .join('\n');

  // Generate annotations list HTML
  const annotationsListHTML = annotations
    .map((annotation, index) => {
      const config = getCategoryConfig(annotation.category);
      const bounds = annotation.boundingBox ?? annotation.screenshotBounds;
      const boundsAttrs = bounds
        ? `data-bx="${bounds.x}" data-by="${bounds.y}" data-bw="${bounds.width}" data-bh="${bounds.height}"`
        : '';
      const ariaLabel = escapeHtml(
        `Annotation ${index + 1}: ${config.label} - ${annotation.element}`
      );
      return `
      <div class="annotation-item" role="button" tabindex="0" aria-pressed="false" aria-label="${ariaLabel}" data-index="${index}" ${boundsAttrs}>
        <div class="annotation-index" style="background-color: ${config.color};">${index + 1}</div>
        <div class="annotation-content">
          <div class="annotation-category">
            <span class="category-dot" style="background-color: ${config.color};"></span>
            ${config.label}
          </div>
          <div class="annotation-element">${escapeHtml(annotation.element)}</div>
          <div class="annotation-comment">${escapeHtml(annotation.comment)}</div>
        </div>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback: ${escapeHtml(pageTitle)}</title>
  <style>
    :root {
${categoryStyles}
      --df-bg: #0f0f10;
      --df-surface: #171717;
      --df-surface-2: #1f1f1f;
      --df-surface-3: #2b2b2b;
      --df-text: #f5f5f7;
      --df-muted: rgba(255, 255, 255, 0.6);
      --df-border: rgba(255, 255, 255, 0.08);
      --df-blue: #3c82f7;
      --ease-smooth: cubic-bezier(0.19, 1, 0.22, 1);
      --ease-pop: cubic-bezier(0.34, 1.2, 0.64, 1);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "Space Grotesk", "Sora", "Avenir Next", "Segoe UI", sans-serif;
      background: radial-gradient(120% 120% at 15% 0%, #1d1d1f 0%, #0f0f10 45%, #0a0a0b 100%);
      color: var(--df-text);
      min-height: 100vh;
    }

    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 18px;
      background: rgba(18, 18, 18, 0.86);
      backdrop-filter: blur(12px) saturate(1.2);
      border-bottom: 1px solid var(--df-border);
      z-index: 1000;
    }

    .header-info h1 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
      letter-spacing: 0.01em;
    }

    .header-info .meta {
      font-size: 11px;
      color: var(--df-muted);
    }

    .header-info .meta a {
      color: var(--df-muted);
      text-decoration: none;
    }

    .header-info .meta a:hover {
      color: #fff;
    }

    .toggle-sidebar {
      background: linear-gradient(135deg, #2b2b2b, #1c1c1c);
      border: 1px solid var(--df-border);
      color: #fff;
      padding: 8px 14px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 12px;
      transition: transform 0.15s var(--ease-smooth), box-shadow 0.2s var(--ease-smooth);
    }

    .toggle-sidebar:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px rgba(0, 0, 0, 0.35);
    }

    .toggle-sidebar:focus-visible {
      outline: 2px solid rgba(60, 130, 247, 0.6);
      outline-offset: 2px;
    }

    .main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      padding-top: 64px;
      height: calc(100vh - 0px);
    }

    .screenshot-container {
      position: relative;
      overflow: auto;
      background: #0b0b0c;
      border-right: 1px solid var(--df-border);
    }

    .screenshot-stage {
      position: relative;
      width: ${pageWidth}px;
      height: ${pageHeight}px;
    }

    .screenshot {
      display: block;
      width: 100%;
      height: 100%;
    }

    .markers-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .focus-box {
      position: absolute;
      border-radius: 12px;
      border: 2px solid rgba(60, 130, 247, 0.85);
      background: rgba(60, 130, 247, 0.12);
      box-shadow:
        0 12px 30px rgba(0, 0, 0, 0.4),
        0 0 0 1px rgba(60, 130, 247, 0.35);
      outline: 9999px solid rgba(0, 0, 0, 0.35);
      opacity: 0;
      transform: scale(0.98);
      transition:
        opacity 0.18s var(--ease-smooth),
        transform 0.18s var(--ease-smooth),
        box-shadow 0.2s var(--ease-smooth);
      pointer-events: none;
    }

    .focus-box.active {
      opacity: 1;
      transform: scale(1);
    }

    .marker {
      position: absolute;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      pointer-events: auto;
      transform: translate(-50%, -50%);
      box-shadow:
        0 8px 18px rgba(0, 0, 0, 0.35),
        0 0 0 1px rgba(255, 255, 255, 0.15);
      transition: transform 0.15s var(--ease-pop), box-shadow 0.2s var(--ease-smooth);
    }

    .marker:hover,
    .marker.active {
      transform: translate(-50%, -50%) scale(1.18);
      z-index: 100;
      box-shadow:
        0 12px 22px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(255, 255, 255, 0.2);
    }

    .marker:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.6);
      outline-offset: 2px;
    }

    .tooltip {
      position: absolute;
      left: 50%;
      top: calc(100% + 10px);
      transform: translateX(-50%) scale(0.96);
      background: rgba(20, 20, 20, 0.98);
      border-radius: 10px;
      padding: 12px;
      min-width: 220px;
      max-width: 320px;
      box-shadow:
        0 12px 30px rgba(0, 0, 0, 0.45),
        0 0 0 1px rgba(255, 255, 255, 0.08);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s var(--ease-smooth), transform 0.15s var(--ease-smooth);
      pointer-events: none;
    }

    .marker:hover .tooltip,
    .marker.active .tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) scale(1);
    }

    .marker:focus-visible .tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) scale(1);
    }

    .tooltip-category {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--df-muted);
      margin-bottom: 6px;
    }

    .tooltip-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
    }

    .tooltip-element {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #fff;
    }

    .tooltip-comment {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.4;
    }

    .tooltip-path {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      font-family: "SF Mono", "JetBrains Mono", ui-monospace, monospace;
      margin-top: 8px;
      word-break: break-all;
    }

    .sidebar {
      width: 340px;
      background: #141414;
      border-left: 1px solid var(--df-border);
      height: calc(100vh - 64px);
      overflow-y: auto;
      flex-shrink: 0;
      transition: margin-right 0.3s var(--ease-smooth);
    }

    .sidebar.hidden {
      margin-right: -340px;
    }

    .sidebar-header {
      padding: 16px 18px;
      border-bottom: 1px solid var(--df-border);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--df-muted);
    }

    .annotations-list {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .annotation-item {
      display: flex;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.03);
      transition:
        background 0.15s var(--ease-smooth),
        border-color 0.15s var(--ease-smooth),
        transform 0.15s var(--ease-smooth);
    }

    .annotation-item:hover {
      background: rgba(255, 255, 255, 0.06);
      transform: translateY(-1px);
    }

    .annotation-item.active {
      background:
        linear-gradient(135deg, rgba(60, 130, 247, 0.18), rgba(60, 130, 247, 0.03)),
        rgba(255, 255, 255, 0.02);
      border-color: rgba(60, 130, 247, 0.45);
    }

    .annotation-item:focus-visible {
      outline: 2px solid rgba(60, 130, 247, 0.5);
      outline-offset: 2px;
    }

    .annotation-index {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.35);
    }

    .annotation-content {
      flex: 1;
      min-width: 0;
    }

    .annotation-category {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
      color: var(--df-muted);
    }

    .category-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2);
    }

    .annotation-element {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .annotation-comment {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    @media (max-width: 900px) {
      .main {
        grid-template-columns: 1fr;
      }

      .sidebar {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-info">
      <h1>Feedback Export</h1>
      <div class="meta">
        <a href="${escapeHtml(pageUrl)}" target="_blank">${escapeHtml(pageTitle)}</a> · ${escapeHtml(exportDate)} · ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}
      </div>
    </div>
    <button class="toggle-sidebar" id="toggle-sidebar" aria-controls="sidebar" aria-expanded="true">Toggle list</button>
  </div>

  <div class="main">
    <div class="screenshot-container">
      <div class="screenshot-stage">
        <img class="screenshot" src="${screenshot}" alt="Page screenshot" width="${pageWidth}" height="${pageHeight}" />
        <div class="markers-layer">
          <div class="focus-box" id="focus-box"></div>
${markersHTML}
        </div>
      </div>
    </div>

    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">Annotations (${annotations.length})</div>
      <div class="annotations-list">
${annotationsListHTML}
      </div>
    </div>
  </div>

  <script>
    // Interactive functionality
    const markers = document.querySelectorAll('.marker');
    const items = document.querySelectorAll('.annotation-item');
    const focusBox = document.getElementById('focus-box');
    const screenshotContainer = document.querySelector('.screenshot-container');
    const toggleButton = document.getElementById('toggle-sidebar');

    function getBounds(el) {
      if (!el || !el.dataset) return null;
      const bx = parseFloat(el.dataset.bx);
      const by = parseFloat(el.dataset.by);
      const bw = parseFloat(el.dataset.bw);
      const bh = parseFloat(el.dataset.bh);
      if (!Number.isFinite(bx) || !Number.isFinite(by) || !Number.isFinite(bw) || !Number.isFinite(bh)) {
        return null;
      }
      return { x: bx, y: by, width: bw, height: bh };
    }

    function updateFocus(bounds) {
      if (!focusBox) return;
      if (!bounds) {
        focusBox.classList.remove('active');
        return;
      }
      focusBox.style.left = bounds.x + 'px';
      focusBox.style.top = bounds.y + 'px';
      focusBox.style.width = bounds.width + 'px';
      focusBox.style.height = bounds.height + 'px';
      focusBox.classList.add('active');
    }

    function scrollToBounds(bounds) {
      if (!bounds || !screenshotContainer) return;
      const targetTop = bounds.y - screenshotContainer.clientHeight / 2 + bounds.height / 2;
      const targetLeft = bounds.x - screenshotContainer.clientWidth / 2 + bounds.width / 2;
      screenshotContainer.scrollTo({
        top: Math.max(0, targetTop),
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }

    function setActive(index) {
      markers.forEach((m, i) => m.classList.toggle('active', i === index));
      items.forEach((item, i) => item.classList.toggle('active', i === index));
      markers.forEach((m, i) => m.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
      items.forEach((item, i) => item.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
      const marker = markers[index];
      const bounds = getBounds(marker) || getBounds(items[index]);
      updateFocus(bounds);
    }

    function clearActive() {
      markers.forEach((m) => m.classList.remove('active'));
      items.forEach((item) => item.classList.remove('active'));
      markers.forEach((m) => m.setAttribute('aria-pressed', 'false'));
      items.forEach((item) => item.setAttribute('aria-pressed', 'false'));
      updateFocus(null);
    }

    markers.forEach((marker, index) => {
      marker.addEventListener('click', () => {
        setActive(index);
        const bounds = getBounds(marker);
        scrollToBounds(bounds);
      });
      marker.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActive(index);
          const bounds = getBounds(marker);
          scrollToBounds(bounds);
        }
      });
    });

    items.forEach((item, index) => {
      item.addEventListener('click', () => {
        setActive(index);
        const bounds = getBounds(item);
        scrollToBounds(bounds);
        if (markers[index]) {
          markers[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setActive(index);
          const bounds = getBounds(item);
          scrollToBounds(bounds);
          if (markers[index]) {
            markers[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });

    function getEventTarget(event) {
      if (event.target instanceof Element) return event.target;
      if (event.target && event.target.parentElement) return event.target.parentElement;
      return null;
    }

    document.addEventListener('click', (event) => {
      const target = getEventTarget(event);
      if (!target) return;
      if (target.closest('#toggle-sidebar')) {
        toggleSidebar();
        return;
      }
      if (target.closest('.marker, .annotation-item')) return;
      clearActive();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        clearActive();
      }
    });

    function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      sidebar.classList.toggle('hidden');
      if (!toggleButton) return;
      toggleButton.setAttribute(
        'aria-expanded',
        sidebar.classList.contains('hidden') ? 'false' : 'true'
      );
    }

    // Toggle is handled in the document click listener for robustness.
  </script>
</body>
</html>`;
}

/**
 * Export as PNG with markers burned in + Markdown notes file
 */
export async function exportAsImageWithNotes(annotations: Annotation[]): Promise<void> {
  // Hide UI before capture
  hideExtensionUI();

  // Small delay to ensure UI is hidden and repaint occurs
  await new Promise((resolve) => setTimeout(resolve, 50));

  let screenshot: string;
  try {
    // Capture full page screenshot
    screenshot = await captureFullPage();
  } finally {
    showExtensionUI();
  }

  // Create canvas and draw screenshot with markers (coordinates are absolute document positions)
  const markedImage = await createMarkedImage(screenshot, annotations);

  // Generate markdown notes
  const markdown = generateNotesMarkdown(annotations);

  // Create ZIP with both files
  const zip = new JSZip();
  const timestamp = new Date().toISOString().split('T')[0];
  const folderName = `feedback-${timestamp}`;
  const folder = zip.folder(folderName)!;

  // Add PNG (convert data URL to binary)
  const base64Data = markedImage.split(',')[1];
  folder.file('feedback.png', base64Data, { base64: true });

  // Add markdown
  folder.file('feedback-notes.md', markdown);

  // Download ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `feedback-${timestamp}.zip`);
}

/**
 * Create image with markers burned in
 */
async function createMarkedImage(
  screenshot: string,
  annotations: Annotation[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      const scaleX = img.width / window.innerWidth;
      const scaleY = img.height / docHeight;

      // Set canvas size to match the screenshot
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw screenshot
      ctx.drawImage(img, 0, 0);

      // Draw markers - use absolute document positions directly
      annotations.forEach((annotation, index) => {
        const config = getCategoryConfig(annotation.category);

        const bounds = annotation.boundingBox ?? annotation.screenshotBounds;
        const point = bounds
          ? { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
          : {
              x: annotation.isFixed ? annotation.x + window.scrollX : annotation.x,
              y: annotation.isFixed ? annotation.y + window.scrollY : annotation.y,
            };

        // Calculate position (scale to screenshot resolution)
        const x = point.x * scaleX;
        const y = point.y * scaleY;
        const markerScale = Math.max(scaleX, scaleY);
        const radius = 14 * markerScale;

        // Draw circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = config.color;
        ctx.fill();

        // Draw shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4 * markerScale;
        ctx.shadowOffsetY = 2 * markerScale;

        // Draw number
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${12 * markerScale}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(index + 1), x, y);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      });

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      reject(new Error('Failed to load screenshot for marking'));
    };

    img.src = screenshot;
  });
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

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
