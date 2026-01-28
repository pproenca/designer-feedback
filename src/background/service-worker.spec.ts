/**
 * Service Worker Tests
 * Tests for icon click behavior and tab tracking
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS } from '@/shared/settings';

// Extended mock for service worker testing
const createMockChrome = () => ({
  runtime: {
    id: 'test-extension-id',
    lastError: null as { message?: string } | null,
    sendMessage: vi.fn(),
    getManifest: vi.fn(() => ({
      content_scripts: [{ js: ['src/content/index.tsx'] }],
    })),
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
  permissions: {
    contains: vi.fn((_perms, callback) => callback(true)),
    request: vi.fn((_perms, callback) => callback(true)),
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
    expect(mockChrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
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

describe('Service Worker - Message Handling', () => {
  let mockChrome: ReturnType<typeof createMockChrome>;
  let onMessageHandler:
    | ((
        message: { type: string; [key: string]: unknown },
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => boolean | void)
    | null = null;

  beforeEach(() => {
    vi.resetModules();
    mockChrome = createMockChrome();
    onMessageHandler = null;

    mockChrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      onMessageHandler = handler as typeof onMessageHandler;
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

  it('handles CAPTURE_SCREENSHOT messages', async () => {
    mockChrome.tabs.captureVisibleTab.mockImplementation((_windowId, _opts, callback) => {
      callback('data:image/png;base64,abc');
    });

    await importServiceWorker();

    const sendResponse = vi.fn();
    const result = onMessageHandler?.(
      { type: 'CAPTURE_SCREENSHOT' },
      { id: mockChrome.runtime.id, tab: { windowId: 5 } } as chrome.runtime.MessageSender,
      sendResponse
    );

    expect(result).toBe(true);
    await Promise.resolve();

    expect(mockChrome.tabs.captureVisibleTab).toHaveBeenCalledWith(
      5,
      { format: 'png' },
      expect.any(Function)
    );
    expect(sendResponse).toHaveBeenCalledWith({
      type: 'SCREENSHOT_CAPTURED',
      data: 'data:image/png;base64,abc',
    });
  });

  it('returns error when screenshot capture fails', async () => {
    mockChrome.tabs.captureVisibleTab.mockImplementation((_windowId, _opts, callback) => {
      mockChrome.runtime.lastError = { message: 'capture failed' };
      callback(null);
    });

    await importServiceWorker();

    const sendResponse = vi.fn();
    onMessageHandler?.(
      { type: 'CAPTURE_SCREENSHOT' },
      { id: mockChrome.runtime.id, tab: { windowId: 7 } } as chrome.runtime.MessageSender,
      sendResponse
    );

    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'SCREENSHOT_CAPTURED',
      data: '',
      error: 'capture failed',
    });
  });

  it('handles CHECK_SCREENSHOT_PERMISSION', async () => {
    mockChrome.permissions.contains.mockImplementation((_perms, callback) => callback(true));
    await importServiceWorker();

    const sendResponse = vi.fn();
    onMessageHandler?.(
      { type: 'CHECK_SCREENSHOT_PERMISSION', origin: 'https://example.com/*' },
      { id: mockChrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse
    );

    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'SCREENSHOT_PERMISSION_STATUS',
      granted: true,
    });
  });

  it('handles REQUEST_SCREENSHOT_PERMISSION', async () => {
    mockChrome.permissions.request.mockImplementation((_perms, callback) => callback(true));
    await importServiceWorker();

    const sendResponse = vi.fn();
    onMessageHandler?.(
      { type: 'REQUEST_SCREENSHOT_PERMISSION', origin: 'https://example.com/*' },
      { id: mockChrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse
    );

    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'SCREENSHOT_PERMISSION_RESPONSE',
      granted: true,
    });
  });

  it('handles DOWNLOAD_FILE messages', async () => {
    mockChrome.downloads.download.mockImplementation((_options, callback) => {
      callback(42);
    });

    await importServiceWorker();

    const sendResponse = vi.fn();
    onMessageHandler?.(
      { type: 'DOWNLOAD_FILE', filename: 'test.png', dataUrl: 'data:' },
      { id: mockChrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse
    );

    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, downloadId: 42 });
  });

  it('handles GET_SETTINGS messages', async () => {
    mockChrome.storage.sync.get.mockImplementation((_defaults, callback) => {
      callback({ ...DEFAULT_SETTINGS, lightMode: false });
    });

    await importServiceWorker();

    const sendResponse = vi.fn();
    onMessageHandler?.(
      { type: 'GET_SETTINGS' },
      { id: mockChrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse
    );

    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'SETTINGS_RESPONSE',
      settings: { ...DEFAULT_SETTINGS, lightMode: false },
    });
  });

  it('handles SAVE_SETTINGS messages', async () => {
    mockChrome.storage.sync.set.mockImplementation((_data, callback) => callback());

    await importServiceWorker();

    const sendResponse = vi.fn();
    const settings = { ...DEFAULT_SETTINGS, enabled: false };
    onMessageHandler?.(
      { type: 'SAVE_SETTINGS', settings },
      { id: mockChrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse
    );

    await Promise.resolve();

    expect(sendResponse).toHaveBeenCalledWith({
      type: 'SETTINGS_RESPONSE',
      settings,
    });
  });

  it('updates badge on UPDATE_BADGE messages', async () => {
    await importServiceWorker();

    const sendResponse = vi.fn();
    const result = onMessageHandler?.(
      { type: 'UPDATE_BADGE', count: 4 },
      { id: mockChrome.runtime.id } as chrome.runtime.MessageSender,
      sendResponse
    );

    expect(result).toBe(false);
    expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({ text: '4' });
  });
});
