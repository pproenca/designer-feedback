// =============================================================================
// Offscreen Document for Blob URL Creation
// =============================================================================
// Chrome MV3 offscreen document with BLOBS reason for converting data URLs
// to blob URLs that can be used with the downloads API.

import type { MessageType } from '@/types';
import { MESSAGE_TARGET, OFFSCREEN_MESSAGE_TYPE } from '@/utils/offscreen-constants';

/**
 * Convert a data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Handle download request by converting data URL to blob URL
 */
function handleDownload(dataUrl: string): { ok: boolean; blobUrl?: string; error?: string } {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const blobUrl = URL.createObjectURL(blob);

    // Schedule cleanup after download completes (60 seconds should be enough)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    return { ok: true, blobUrl };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// Listen for messages from the background service worker
// Note: Using chrome namespace since offscreen documents are Chrome-only and don't have WXT's browser polyfill
console.log('[Offscreen] Document loaded, registering message listener');
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: { ok: boolean; blobUrl?: string; error?: string }) => void
  ) => {
    const msg = message as MessageType & { target?: string };
    console.log('[Offscreen] Received message:', msg.type, 'from:', sender.id);

    // Filter messages not targeted at offscreen document
    if (msg.target && msg.target !== MESSAGE_TARGET.OFFSCREEN) {
      return false;
    }

    // Only handle OFFSCREEN_DOWNLOAD messages
    if (msg.type === OFFSCREEN_MESSAGE_TYPE.DOWNLOAD) {
      console.log('[Offscreen] Processing OFFSCREEN_DOWNLOAD, dataUrl length:', (msg as { dataUrl?: string }).dataUrl?.length);
      try {
        const result = handleDownload((msg as { dataUrl: string }).dataUrl);
        console.log('[Offscreen] handleDownload result:', JSON.stringify({ ok: result.ok, hasBlobUrl: !!result.blobUrl, error: result.error }));
        sendResponse(result);
      } catch (error) {
        console.error('[Offscreen] handleDownload error:', error);
        sendResponse({ ok: false, error: String(error) });
      }
      return true; // Keep channel open for async response
    }

    // Don't respond to other messages - let them pass through
    return false;
  }
);
