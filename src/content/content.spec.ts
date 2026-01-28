import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '../test/setup';
import { mountUI } from './mount';
import { getAnnotationCount, getStorageKey } from '@/utils/storage';

vi.mock('./mount', () => ({
  mountUI: vi.fn().mockResolvedValue(undefined),
  unmountUI: vi.fn(),
}));

vi.mock('@/utils/storage', () => ({
  getAnnotationCount: vi.fn().mockResolvedValue(0),
  getStorageKey: vi.fn().mockReturnValue('https://example.com'),
}));

describe('Content Script Listener Cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (window as { __designerFeedbackInjected?: boolean }).__designerFeedbackInjected =
      undefined;
    Object.defineProperty(document, 'contentType', {
      value: 'text/html',
      configurable: true,
    });
  });

  it('registers runtime message listener', async () => {
    await import('./index');

    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
  });

  it('removes message listener on beforeunload', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    await import('./index');

    const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];

    const beforeUnloadHandler = addEventListenerSpy.mock.calls.find(
      ([event]) => event === 'beforeunload'
    )?.[1];

    expect(beforeUnloadHandler).toBeDefined();

    if (typeof beforeUnloadHandler === 'function') {
      beforeUnloadHandler(new Event('beforeunload'));
    }

    expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(
      messageListener
    );
  });
});

describe('Content Script Message Handling', () => {
  const mockedMountUI = vi.mocked(mountUI);
  const mockedGetAnnotationCount = vi.mocked(getAnnotationCount);
  const mockedGetStorageKey = vi.mocked(getStorageKey);

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    (window as { __designerFeedbackInjected?: boolean }).__designerFeedbackInjected =
      undefined;
    Object.defineProperty(document, 'contentType', {
      value: 'text/html',
      configurable: true,
    });
  });

  const getMessageListener = async () => {
    await import('./index');
    return mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
  };

  it('handles SHOW_TOOLBAR by mounting only once', async () => {
    const messageListener = await getMessageListener();

    messageListener?.({ type: 'SHOW_TOOLBAR' }, {} as chrome.runtime.MessageSender, vi.fn());
    await Promise.resolve();
    messageListener?.({ type: 'SHOW_TOOLBAR' }, {} as chrome.runtime.MessageSender, vi.fn());

    expect(mockedMountUI).toHaveBeenCalledTimes(1);
  });

  it('handles GET_ANNOTATION_COUNT by responding with count', async () => {
    mockedGetStorageKey.mockReturnValue('https://example.com/page');
    mockedGetAnnotationCount.mockResolvedValue(3);

    const messageListener = await getMessageListener();
    const sendResponse = vi.fn();

    const result = messageListener?.(
      { type: 'GET_ANNOTATION_COUNT' },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    expect(result).toBe(true);
    await Promise.resolve();
    expect(mockedGetAnnotationCount).toHaveBeenCalledWith('https://example.com/page');
    expect(sendResponse).toHaveBeenCalledWith({ count: 3 });
  });

  it('handles TRIGGER_EXPORT by dispatching event', async () => {
    vi.useFakeTimers();
    const messageListener = await getMessageListener();

    const eventHandler = vi.fn();
    document.addEventListener('designer-feedback:open-export', eventHandler, {
      once: true,
    });

    messageListener?.({ type: 'TRIGGER_EXPORT' }, {} as chrome.runtime.MessageSender, vi.fn());

    await vi.runAllTimersAsync();

    expect(mockedMountUI).toHaveBeenCalledTimes(1);
    expect(eventHandler).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
