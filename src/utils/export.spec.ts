import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadDataUrl, exportAsImageWithNotes } from './export';
import { mockChrome } from '../test/setup';

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
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  beforeEach(() => {
    vi.useFakeTimers();
    clickSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to anchor download when background download is unavailable', async () => {
    delete (mockChrome.runtime as { id?: string }).id;

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    expect(clickSpy).toHaveBeenCalled();
  });

  it('falls back to anchor download when background download fails', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (mockChrome.runtime as { id?: string }).id = 'abc';
    mockChrome.runtime.sendMessage.mockImplementation((_message, callback) => {
      callback({ ok: false, error: 'nope' });
    });

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('uses background download when available and successful', async () => {
    (mockChrome.runtime as { id?: string }).id = 'abc';
    mockChrome.runtime.sendMessage.mockImplementation((_message, callback) => {
      callback({ ok: true });
    });

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
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
