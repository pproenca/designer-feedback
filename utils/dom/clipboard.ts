import {getDocument, getNavigator} from '@/utils/dom/guards';

export async function copyToClipboard(text: string): Promise<void> {
  const navigatorRef = getNavigator('copyToClipboard');
  if (navigatorRef.clipboard?.writeText) {
    await navigatorRef.clipboard.writeText(text);
    return;
  }

  const doc = getDocument('copyToClipboard');
  const textarea = doc.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  doc.body.appendChild(textarea);
  textarea.select();
  const copied = doc.execCommand('copy');
  doc.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Clipboard copy failed');
  }
}
