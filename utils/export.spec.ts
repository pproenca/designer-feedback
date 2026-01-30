import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { downloadDataUrl, exportAsImageWithNotes } from './export';

const mockAnnotations = [
  {
    id: '1',
    x: 10,
    y: 10,
    comment: 'Test comment',
    category: 'bug' as const,
    element: 'div',
    elementPath: 'body > div',
    timestamp: Date.now(),
    isFixed: false,
  },
];

describe('export utilities', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.useFakeTimers();
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('downloads file via background service worker', async () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ ok: true } as unknown as void);

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    // Data URLs are passed to background, which handles blob conversion via offscreen document
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'DOWNLOAD_FILE',
      filename: 'test.txt',
      dataUrl: 'data:text/plain;base64,SGVsbG8=',
    });
    spy.mockRestore();
  });

  it('throws error when background download fails', async () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ ok: false, error: 'nope' } as unknown as void);

    await expect(downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt')).rejects.toThrow('nope');

    spy.mockRestore();
  });

  it('falls back to execCommand copy when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    if (!document.execCommand) {
      Object.defineProperty(document, 'execCommand', {
        value: () => true,
        configurable: true,
      });
    }
    const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);

    await exportAsImageWithNotes(mockAnnotations);

    expect(execSpy).toHaveBeenCalledWith('copy');
    execSpy.mockRestore();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });
});
