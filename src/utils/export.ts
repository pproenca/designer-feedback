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

  // Generate category CSS variables
  const categoryStyles = CATEGORIES.map(
    (c) => `    --color-${c.id}: ${c.color};`
  ).join('\n');

  // Generate markers HTML - use absolute document positions directly
  const markersHTML = annotations
    .map((annotation, index) => {
      const config = getCategoryConfig(annotation.category);
      const leftPercent = annotation.x * 100;
      // Use annotation.y directly (absolute document position)
      const topPx = annotation.y;

      return `
    <div class="marker" style="left: ${leftPercent}%; top: ${topPx}px; background-color: ${config.color};" data-index="${index + 1}">
      ${index + 1}
      <div class="tooltip">
        <div class="tooltip-category" style="color: ${config.color};">${config.emoji} ${config.label}</div>
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
      return `
      <div class="annotation-item" data-index="${index}">
        <div class="annotation-index" style="background-color: ${config.color};">${index + 1}</div>
        <div class="annotation-content">
          <div class="annotation-category">${config.emoji} ${config.label}</div>
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
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #1a1a1a;
      color: #fff;
      min-height: 100vh;
    }

    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(26, 26, 26, 0.95);
      backdrop-filter: blur(10px);
      padding: 12px 20px;
      border-bottom: 1px solid #333;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-info h1 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .header-info .meta {
      font-size: 11px;
      color: #888;
    }

    .header-info .meta a {
      color: #888;
      text-decoration: none;
    }

    .header-info .meta a:hover {
      color: #fff;
    }

    .toggle-sidebar {
      background: #333;
      border: none;
      color: #fff;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
    }

    .toggle-sidebar:hover {
      background: #444;
    }

    .main {
      display: flex;
      padding-top: 60px;
    }

    .screenshot-container {
      flex: 1;
      position: relative;
      overflow: auto;
    }

    .screenshot {
      display: block;
      max-width: 100%;
    }

    .markers-layer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }

    .marker {
      position: absolute;
      width: 24px;
      height: 24px;
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
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: transform 0.15s ease;
    }

    .marker:hover {
      transform: translate(-50%, -50%) scale(1.2);
      z-index: 100;
    }

    .marker.active {
      transform: translate(-50%, -50%) scale(1.2);
      z-index: 100;
    }

    .tooltip {
      position: absolute;
      left: 50%;
      top: 100%;
      transform: translateX(-50%);
      margin-top: 8px;
      background: #222;
      border-radius: 8px;
      padding: 12px;
      min-width: 200px;
      max-width: 300px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s ease, visibility 0.15s ease;
      pointer-events: none;
    }

    .marker:hover .tooltip,
    .marker.active .tooltip {
      opacity: 1;
      visibility: visible;
    }

    .tooltip-category {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .tooltip-element {
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 6px;
      color: #fff;
    }

    .tooltip-comment {
      font-size: 12px;
      color: #ccc;
      line-height: 1.4;
    }

    .tooltip-path {
      font-size: 10px;
      color: #666;
      font-family: monospace;
      margin-top: 8px;
      word-break: break-all;
    }

    .sidebar {
      width: 320px;
      background: #222;
      border-left: 1px solid #333;
      height: calc(100vh - 60px);
      overflow-y: auto;
      flex-shrink: 0;
      transition: margin-right 0.3s ease;
    }

    .sidebar.hidden {
      margin-right: -320px;
    }

    .sidebar-header {
      padding: 16px;
      border-bottom: 1px solid #333;
      font-size: 13px;
      font-weight: 600;
    }

    .annotations-list {
      padding: 8px;
    }

    .annotation-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .annotation-item:hover {
      background: #2a2a2a;
    }

    .annotation-item.active {
      background: #333;
    }

    .annotation-index {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .annotation-content {
      flex: 1;
      min-width: 0;
    }

    .annotation-category {
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 2px;
      color: #888;
    }

    .annotation-element {
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .annotation-comment {
      font-size: 12px;
      color: #999;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-info">
      <h1>Feedback Report</h1>
      <div class="meta">
        <a href="${escapeHtml(pageUrl)}" target="_blank">${escapeHtml(pageTitle)}</a> · ${escapeHtml(exportDate)} · ${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}
      </div>
    </div>
    <button class="toggle-sidebar" onclick="toggleSidebar()">Toggle List</button>
  </div>

  <div class="main">
    <div class="screenshot-container">
      <img class="screenshot" src="${screenshot}" alt="Page screenshot" />
      <div class="markers-layer">
${markersHTML}
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

    function setActive(index) {
      markers.forEach((m, i) => m.classList.toggle('active', i === index));
      items.forEach((item, i) => item.classList.toggle('active', i === index));
    }

    markers.forEach((marker, index) => {
      marker.addEventListener('click', () => setActive(index));
    });

    items.forEach((item, index) => {
      item.addEventListener('click', () => {
        setActive(index);
        markers[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });

    function toggleSidebar() {
      document.getElementById('sidebar').classList.toggle('hidden');
    }
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
      const dpr = window.devicePixelRatio || 1;

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

        // Calculate position (scale by DPR since screenshot is captured at DPR)
        const x = annotation.x * img.width;
        const y = annotation.y * dpr;

        const radius = 14 * dpr;

        // Draw circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = config.color;
        ctx.fill();

        // Draw shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4 * dpr;
        ctx.shadowOffsetY = 2 * dpr;

        // Draw number
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${12 * dpr}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
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
