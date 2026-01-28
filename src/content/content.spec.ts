import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '../test/setup';

vi.mock('./mount', () => ({
  mountUI: vi.fn().mockResolvedValue(undefined),
  unmountUI: vi.fn(),
}));

vi.mock('@/utils/site-access', () => ({
  isUrlAllowed: vi.fn(() => true),
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

    mockChrome.storage.sync.get.mockImplementation(
      (defaults: unknown, callback: (result: unknown) => void) => {
        callback({
          ...(defaults as Record<string, unknown>),
          enabled: true,
          lightMode: false,
          siteListMode: 'blocklist',
          siteList: [],
        });
      }
    );
  });

  it('registers runtime and storage listeners', async () => {
    await import('./index');

    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(mockChrome.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
  });

  it('removes listeners on beforeunload', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    await import('./index');

    const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0]?.[0];
    const storageListener =
      mockChrome.storage.onChanged.addListener.mock.calls[0]?.[0];

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
    expect(mockChrome.storage.onChanged.removeListener).toHaveBeenCalledWith(
      storageListener
    );
  });
});
