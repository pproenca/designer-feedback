

import type { Annotation } from '@/types';
import { backgroundMessenger, withTimeout } from '@/utils/messaging';
import { captureFullPage } from '@/utils/dom/screenshot';
import { copyToClipboard } from '@/utils/dom/clipboard';
import { generateNotesMarkdown } from './export/markdown';
import { createSnapshotImage } from '@/utils/dom/snapshot';
import { getDocument, getWindow } from '@/utils/dom/guards';

export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const response = await withTimeout(
    backgroundMessenger.sendMessage('downloadFile', { filename, dataUrl })
  );
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Download failed');
  }
}

export async function exportAsSnapshotImage(
  annotations: Annotation[]
): Promise<{ captureMode: 'full' | 'viewport' | 'placeholder'; error?: string }> {
  let screenshot: string;
  let captureMode: 'full' | 'viewport' | 'placeholder' = 'full';
  let captureError: string | undefined;
  const capture = await captureFullPage();
  screenshot = capture.dataUrl;
  captureMode = capture.mode;
  captureError = capture.error;

  const composite = await createSnapshotImage(screenshot, annotations);
  const timestamp = new Date().toISOString().split('T')[0];
  await downloadDataUrl(composite, `feedback-${timestamp}.png`);
  return { captureMode, error: captureError };
}

export async function exportAsImageWithNotes(annotations: Annotation[]): Promise<void> {
  const doc = getDocument('exportAsImageWithNotes');
  const win = getWindow('exportAsImageWithNotes');
  const markdown = generateNotesMarkdown(annotations, {
    title: doc.title,
    url: win.location.href,
    exportedAt: new Date().toLocaleString(),
  });
  await copyToClipboard(markdown);
}
