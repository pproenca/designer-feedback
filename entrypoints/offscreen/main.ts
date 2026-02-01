type OffscreenDownloadMessage = {
  dfOffscreen: 'download';
  dataUrl: string;
  filename: string;
};

type OffscreenDownloadResponse = {
  ok: boolean;
  downloadId?: number;
  error?: string;
};

const DOWNLOAD_URL_REVOKE_DELAY_MS = 60000;

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  if (!header || data === undefined) {
    throw new Error('Invalid data URL');
  }
  const mimeMatch = header.match(/:(.*?)(;|$)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const isBase64 = header.includes(';base64');
  const byteString = isBase64 ? atob(data) : decodeURIComponent(data);
  const array = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    array[i] = byteString.charCodeAt(i);
  }
  return new Blob([array], {type: mime});
}

function scheduleRevokeBlobUrl(blobUrl: string): void {
  setTimeout(() => URL.revokeObjectURL(blobUrl), DOWNLOAD_URL_REVOKE_DELAY_MS);
}

async function handleDownload(
  message: OffscreenDownloadMessage
): Promise<OffscreenDownloadResponse> {
  try {
    const blob = dataUrlToBlob(message.dataUrl);
    const blobUrl = URL.createObjectURL(blob);

    const downloadId = await browser.downloads.download({
      url: blobUrl,
      filename: message.filename,
      saveAs: false,
    });

    if (downloadId === undefined) {
      return {ok: false, error: 'Download failed to start'};
    }

    scheduleRevokeBlobUrl(blobUrl);
    return {ok: true, downloadId};
  } catch (error) {
    console.error('[Offscreen] Download failed:', error);
    return {ok: false, error: String(error)};
  }
}

browser.runtime.onMessage.addListener((message, sender) => {
  if (sender.id && sender.id !== browser.runtime.id) {
    return;
  }
  if (
    !message ||
    typeof message !== 'object' ||
    (message as {dfOffscreen?: string}).dfOffscreen !== 'download'
  ) {
    return;
  }
  return handleDownload(message as OffscreenDownloadMessage);
});
