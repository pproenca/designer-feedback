

import type { Annotation } from '@/types';
import { backgroundMessenger, withTimeout } from '@/utils/messaging';
import { captureFullPage } from './screenshot';
import { emitUiEvent } from './ui-events';
import { copyToClipboard } from './export/clipboard';
import { generateNotesMarkdown } from './export/markdown';
import { createSnapshotImage } from './export/snapshot';

export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const response = await withTimeout(
    backgroundMessenger.sendMessage('downloadFile', { filename, dataUrl })
  );
  if (!response?.ok) {
    throw new Error(response?.error ?? 'Download failed');
  }
}

const hideExtensionUI = () => emitUiEvent('hide-ui');
const showExtensionUI = () => emitUiEvent('show-ui');

export async function exportAsSnapshotImage(
  annotations: Annotation[]
): Promise<{ captureMode: 'full' | 'viewport' | 'placeholder'; error?: string }> {

  hideExtensionUI();


  await new Promise((resolve) => setTimeout(resolve, 50));

  let screenshot: string;
  let captureMode: 'full' | 'viewport' | 'placeholder' = 'full';
  let captureError: string | undefined;
  try {
    const capture = await captureFullPage();
    screenshot = capture.dataUrl;
    captureMode = capture.mode;
    captureError = capture.error;
  } finally {
    showExtensionUI();
  }

  const composite = await createSnapshotImage(screenshot, annotations);
  const timestamp = new Date().toISOString().split('T')[0];
  await downloadDataUrl(composite, `feedback-${timestamp}.png`);
  return { captureMode, error: captureError };
}

export async function exportAsImageWithNotes(annotations: Annotation[]): Promise<void> {
  const markdown = generateNotesMarkdown(annotations);
  await copyToClipboard(markdown);
}
