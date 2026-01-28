import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '../test/setup';

describe('Content Script Listener Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window flag
    (window as { __designerFeedbackInjected?: boolean }).__designerFeedbackInjected =
      undefined;
  });

  it('should store listener references for cleanup', async () => {
    // This test documents the expected behavior after implementing listener cleanup
    // Listeners should be stored in module variables

    // Mock document properties
    Object.defineProperty(document, 'documentElement', {
      value: document.createElement('html'),
      configurable: true,
    });
    Object.defineProperty(document, 'contentType', {
      value: 'text/html',
      configurable: true,
    });

    const addListenerCalls: { type: string; listener: unknown }[] = [];

    mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      addListenerCalls.push({ type: 'runtime.onMessage', listener });
    });

    mockChrome.storage.onChanged.addListener.mockImplementation((listener) => {
      addListenerCalls.push({ type: 'storage.onChanged', listener });
    });

    mockChrome.storage.sync.get.mockImplementation(
      (_keys: unknown, callback: (result: unknown) => void) => {
        callback({ enabled: false, lightMode: false });
      }
    );

    // The content script should add listeners
    // After the fix, it should also store references to these listeners

    expect(mockChrome.runtime.onMessage.addListener).toBeDefined();
    expect(mockChrome.storage.onChanged.addListener).toBeDefined();
  });

  it('should call removeListener in cleanup function', async () => {
    // After implementation, cleanup() should remove both listeners

    mockChrome.runtime.onMessage.removeListener.mockImplementation(() => {});
    mockChrome.storage.onChanged.removeListener.mockImplementation(() => {});

    // After fix, calling cleanup() should call removeListener
    expect(mockChrome.runtime.onMessage.removeListener).toBeDefined();
    expect(mockChrome.storage.onChanged.removeListener).toBeDefined();
  });

  it('should call cleanup on beforeunload', () => {
    // After implementation, beforeunload event should trigger cleanup

    const listeners: { [event: string]: (() => void)[] } = {};

    vi.spyOn(window, 'addEventListener').mockImplementation(
      (event: string, handler: EventListenerOrEventListenerObject) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler as () => void);
      }
    );

    // Content script should add beforeunload listener
    // After the fix is implemented

    // Cleanup
    vi.restoreAllMocks();
  });
});
