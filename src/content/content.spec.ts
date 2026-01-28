import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '../test/setup';

vi.mock('./mount', () => ({
  mountUI: vi.fn().mockResolvedValue(undefined),
  unmountUI: vi.fn(),
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
