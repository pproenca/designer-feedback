import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetMockStorage } from '../test/setup';
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
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  beforeEach(() => {
    vi.useFakeTimers();
    clickSpy.mockClear();
    resetMockStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('falls back to anchor download when background download is unavailable', async () => {
    // Simulate no extension context by having sendMessage reject
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockRejectedValue(new Error('No extension context'));

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    expect(clickSpy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('falls back to anchor download when background download fails', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ ok: false, error: 'nope' });

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    expect(browser.runtime.sendMessage).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
    spy.mockRestore();
  });

  it('uses background download when available and successful', async () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue({ ok: true });

    await downloadDataUrl('data:text/plain;base64,SGVsbG8=', 'test.txt');

    expect(browser.runtime.sendMessage).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
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
