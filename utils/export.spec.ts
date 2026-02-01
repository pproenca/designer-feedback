// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// Mock backgroundMessenger and withTimeout
const mockSendMessage = vi.fn();
vi.mock('@/utils/messaging', () => ({
  backgroundMessenger: {
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  },
  withTimeout: <T>(promise: Promise<T>) => promise,
}));

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
    mockSendMessage.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('downloads file via background service worker', async () => {
    mockSendMessage.mockResolvedValue({ ok: true });

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    expect(mockSendMessage).toHaveBeenCalledWith('downloadFile', {
      filename: 'test.txt',
      dataUrl: 'data:text/plain;base64,SGVsbG8=',
    });
  });

  it('throws error when background download fails', async () => {
    mockSendMessage.mockResolvedValue({ ok: false, error: 'nope' });

    await expect(downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt')).rejects.toThrow(
      'nope'
    );
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
