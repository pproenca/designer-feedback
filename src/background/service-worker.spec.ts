/**
 * Service Worker Tests
 * Tests for icon click behavior and tab tracking
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Extended mock for service worker testing
const createMockChrome = () => ({
  runtime: {
    id: 'test-extension-id',
    lastError: null as { message?: string } | null,
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn((defaults, callback) => callback?.(defaults)),
      set: vi.fn((_data, callback) => callback?.()),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    captureVisibleTab: vi.fn(),
    onUpdated: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  action: {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
  },
  downloads: {
    download: vi.fn(),
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
  },
});

describe('Service Worker - Icon Click Handler', () => {
  let mockChrome: ReturnType<typeof createMockChrome>;
  let onClickedHandler: ((tab: chrome.tabs.Tab) => void) | null = null;

  beforeEach(() => {
    vi.resetModules();
    mockChrome = createMockChrome();
    onClickedHandler = null;

    // Capture the onClicked handler when it's registered
    mockChrome.action.onClicked.addListener.mockImplementation((handler) => {
      onClickedHandler = handler;
    });

    Object.defineProperty(globalThis, 'chrome', {
      value: mockChrome,
      writable: true,
      configurable: true,
    });
  });

  const importServiceWorker = async () => {
    await import('./service-worker');
  };

  it('should register chrome.action.onClicked listener on load', async () => {
    await importServiceWorker();
    expect(mockChrome.action.onClicked.addListener).toHaveBeenCalledTimes(1);
    expect(onClickedHandler).toBeInstanceOf(Function);
  });

  it('should send SHOW_TOOLBAR message when icon is clicked on http page', async () => {
    mockChrome.tabs.sendMessage.mockResolvedValueOnce({});

    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'https://example.com/page',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    // Content script is injected via manifest, so we just send the message
    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, { type: 'SHOW_TOOLBAR' });
  });

  it('should not send message on non-http URLs (chrome://)', async () => {
    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'chrome://extensions',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send message on file:// URLs', async () => {
    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'file:///home/user/document.html',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send message on about: URLs', async () => {
    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'about:blank',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should return early if tab has no id', async () => {
    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: undefined,
      url: 'https://example.com',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should return early if tab has no url', async () => {
    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: 123,
      url: undefined,
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle sendMessage errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Could not establish connection'));

    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'https://example.com/page',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    // Should not throw
    await expect(onClickedHandler?.(tab)).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith('Failed to show toolbar:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});

describe('Service Worker - Same-Origin Tab Tracking', () => {
  let mockChrome: ReturnType<typeof createMockChrome>;
  let onClickedHandler: ((tab: chrome.tabs.Tab) => void) | null = null;
  let onUpdatedHandler:
    | ((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void)
    | null = null;
  let onRemovedHandler: ((tabId: number) => void) | null = null;

  beforeEach(() => {
    vi.resetModules();
    mockChrome = createMockChrome();
    onClickedHandler = null;
    onUpdatedHandler = null;
    onRemovedHandler = null;

    mockChrome.action.onClicked.addListener.mockImplementation((handler) => {
      onClickedHandler = handler;
    });
    mockChrome.tabs.onUpdated.addListener.mockImplementation((handler) => {
      onUpdatedHandler = handler;
    });
    mockChrome.tabs.onRemoved.addListener.mockImplementation((handler) => {
      onRemovedHandler = handler;
    });

    Object.defineProperty(globalThis, 'chrome', {
      value: mockChrome,
      writable: true,
      configurable: true,
    });
  });

  const importServiceWorker = async () => {
    await import('./service-worker');
  };

  it('should register tab tracking listeners', async () => {
    await importServiceWorker();

    expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
    expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
  });

  it('should re-send SHOW_TOOLBAR on same-origin navigation', async () => {
    mockChrome.tabs.sendMessage.mockResolvedValue({});

    await importServiceWorker();

    // First, activate on a tab
    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'https://example.com/page1',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    // Clear mocks to track next calls
    vi.clearAllMocks();
    mockChrome.tabs.sendMessage.mockResolvedValue({});

    // Navigate to same origin
    onUpdatedHandler?.(
      123,
      { status: 'complete' },
      { ...tab, url: 'https://example.com/page2' }
    );

    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, { type: 'SHOW_TOOLBAR' });
    });
  });

  it('should NOT re-send on different-origin navigation', async () => {
    mockChrome.tabs.sendMessage.mockResolvedValue({});

    await importServiceWorker();

    // First, activate on a tab
    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'https://example.com/page1',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);

    // Clear mocks to track next calls
    vi.clearAllMocks();

    // Navigate to different origin
    onUpdatedHandler?.(
      123,
      { status: 'complete' },
      { ...tab, url: 'https://other-site.com/page' }
    );

    // Should NOT re-send
    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should cleanup tracking on tab close', async () => {
    mockChrome.tabs.sendMessage.mockResolvedValue({});

    await importServiceWorker();

    // Activate on a tab
    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'https://example.com/page1',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);
    vi.clearAllMocks();

    // Close the tab
    onRemovedHandler?.(123);

    // Navigate event after close should not trigger message
    onUpdatedHandler?.(
      123,
      { status: 'complete' },
      { ...tab, url: 'https://example.com/page2' }
    );

    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it('should ignore onUpdated events without status complete', async () => {
    mockChrome.tabs.sendMessage.mockResolvedValue({});

    await importServiceWorker();

    const tab: chrome.tabs.Tab = {
      id: 123,
      url: 'https://example.com/page1',
      index: 0,
      pinned: false,
      highlighted: true,
      windowId: 1,
      active: true,
      incognito: false,
      selected: true,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
    };

    await onClickedHandler?.(tab);
    vi.clearAllMocks();

    // Loading event (not complete)
    onUpdatedHandler?.(123, { status: 'loading' }, { ...tab, url: 'https://example.com/page2' });

    expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
