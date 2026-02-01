import {browser, type Browser} from 'wxt/browser';
import {
  MESSAGE_TARGET,
  OFFSCREEN_MESSAGE_TYPE,
} from '@/utils/offscreen-constants';

interface OffscreenMessage {
  type: string;
  target?: string;
  dataUrl?: string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], {type: mime});
}

function handleDownload(dataUrl: string): {
  ok: boolean;
  blobUrl?: string;
  error?: string;
} {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const blobUrl = URL.createObjectURL(blob);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    return {ok: true, blobUrl};
  } catch (error) {
    return {ok: false, error: String(error)};
  }
}

browser.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: Browser.runtime.MessageSender,
    sendResponse: (response: {
      ok: boolean;
      blobUrl?: string;
      error?: string;
    }) => void
  ) => {
    const msg = message as OffscreenMessage;

    if (msg.target && msg.target !== MESSAGE_TARGET.OFFSCREEN) {
      return false;
    }

    if (msg.type === OFFSCREEN_MESSAGE_TYPE.DOWNLOAD) {
      try {
        const result = handleDownload(msg.dataUrl ?? '');
        sendResponse(result);
      } catch (error) {
        console.error('[Offscreen] handleDownload error:', error);
        sendResponse({ok: false, error: String(error)});
      }
      return true;
    }

    return false;
  }
);
