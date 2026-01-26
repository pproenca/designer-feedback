// =============================================================================
// Export Utilities
// =============================================================================

import JSZip from 'jszip';
import type { Annotation, FeedbackExport, FeedbackCategory } from '@/types';
import { getCategoryConfig, CATEGORIES } from '@/shared/categories';
import { captureScreenshot } from './screenshot';

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
 * Export and download feedback as ZIP
 */
export async function exportFeedback(annotations: Annotation[]): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const blob = await createExportZip(annotations);
  downloadBlob(blob, `feedback-${timestamp}.zip`);
}
