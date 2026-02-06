import {describe, expect, it, vi} from 'vitest';
import {
  ActivationController,
  type ActivationControllerDeps,
  type ActivationInvocation,
} from './activation-controller';

function createDeps(
  overrides: Partial<ActivationControllerDeps> = {}
): ActivationControllerDeps {
  return {
    getContentScriptFiles: () => ['content-scripts/content.js'],
    isInjectableUrl: (url: string) =>
      url.startsWith('http://') || url.startsWith('https://'),
    getToolbarStatus: vi.fn().mockResolvedValue({mounted: false}),
    pingToolbar: vi.fn().mockResolvedValue({ready: true}),
    showToolbar: vi.fn().mockResolvedValue({mounted: true}),
    toggleToolbar: vi.fn().mockResolvedValue({mounted: false}),
    executeScript: vi.fn().mockResolvedValue(undefined),
    notifyActivationFailure: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn(async () => undefined),
    createTrace: () => ({attemptId: 'test-attempt', step: vi.fn()}),
    ...overrides,
  };
}

function createInvocation(
  overrides: Partial<ActivationInvocation> = {}
): ActivationInvocation {
  return {
    source: 'action',
    intent: 'toggle',
    tab: {id: 1} as ActivationInvocation['tab'],
    ...overrides,
  };
}

describe('ActivationController', () => {
  it('activates when tab.url is missing', async () => {
    const getToolbarStatus = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Could not establish connection. Receiving end does not exist.'
        )
      )
      .mockResolvedValueOnce({mounted: false});
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const showToolbar = vi.fn().mockResolvedValue({mounted: true});

    const controller = new ActivationController(
      createDeps({
        getToolbarStatus,
        executeScript,
        showToolbar,
      })
    );

    const result = await controller.handleInvocation(
      createInvocation({
        tab: {id: 7, url: undefined} as ActivationInvocation['tab'],
      })
    );

    expect(result).toMatchObject({
      ok: true,
      tabId: 7,
      action: 'opened',
      changed: true,
    });
    expect(executeScript).toHaveBeenCalledWith(7, [
      'content-scripts/content.js',
    ]);
    expect(showToolbar).toHaveBeenCalledWith(7);
  });

  it('returns restricted-url for known restricted tab URLs', async () => {
    const notifyActivationFailure = vi.fn().mockResolvedValue(undefined);
    const executeScript = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({
        notifyActivationFailure,
        executeScript,
      })
    );

    const result = await controller.handleInvocation(
      createInvocation({
        intent: 'open',
        tab: {id: 4, url: 'chrome://extensions'} as ActivationInvocation['tab'],
      })
    );

    expect(result).toEqual({
      ok: false,
      tabId: 4,
      reason: 'restricted-url',
      changed: false,
    });
    expect(notifyActivationFailure).toHaveBeenCalledWith(4, 'restricted-url');
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('injects and pings when no content receiver exists', async () => {
    const getToolbarStatus = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Could not establish connection. Receiving end does not exist.'
        )
      )
      .mockResolvedValueOnce({mounted: false});
    const pingToolbar = vi.fn().mockResolvedValue({ready: true});
    const executeScript = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({
        getToolbarStatus,
        pingToolbar,
        executeScript,
      })
    );

    const result = await controller.handleInvocation(
      createInvocation({
        intent: 'open',
        tab: {
          id: 22,
          url: 'https://example.com',
        } as ActivationInvocation['tab'],
      })
    );

    expect(result.ok).toBe(true);
    expect(executeScript).toHaveBeenCalledTimes(1);
    expect(pingToolbar).toHaveBeenCalledWith(22);
  });

  it('closes toolbar when toggle is invoked while mounted', async () => {
    const toggleToolbar = vi.fn().mockResolvedValue({mounted: false});

    const controller = new ActivationController(
      createDeps({
        getToolbarStatus: vi.fn().mockResolvedValue({mounted: true}),
        toggleToolbar,
      })
    );

    const result = await controller.handleInvocation(
      createInvocation({
        intent: 'toggle',
        tab: {id: 9, url: 'https://example.com'} as ActivationInvocation['tab'],
      })
    );

    expect(result).toMatchObject({
      ok: true,
      tabId: 9,
      action: 'closed',
      changed: true,
    });
    expect(toggleToolbar).toHaveBeenCalledWith(9, false);
  });

  it('uses context menu pageUrl when tab.url is absent', async () => {
    const notifyActivationFailure = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({notifyActivationFailure})
    );

    const result = await controller.handleInvocation({
      source: 'context-menu-open-toolbar',
      intent: 'open',
      tab: {id: 16, url: undefined} as ActivationInvocation['tab'],
      pageUrl: 'chrome://settings',
    });

    expect(result.reason).toBe('restricted-url');
    expect(notifyActivationFailure).toHaveBeenCalledWith(16, 'restricted-url');
  });

  it('returns missing-tab-id when invocation has no tab id', async () => {
    const notifyActivationFailure = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({notifyActivationFailure})
    );

    const result = await controller.handleInvocation(
      createInvocation({tab: undefined})
    );

    expect(result).toEqual({
      ok: false,
      tabId: undefined,
      reason: 'missing-tab-id',
      changed: false,
    });
    expect(notifyActivationFailure).toHaveBeenCalledWith(
      undefined,
      'missing-tab-id'
    );
  });

  it('falls back to legacy showToolbar after bounded ping retries', async () => {
    const pingToolbar = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Could not establish connection. Receiving end does not exist.'
        )
      );
    const showToolbar = vi.fn().mockResolvedValue(undefined);
    const notifyActivationFailure = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({
        getToolbarStatus: vi
          .fn()
          .mockRejectedValueOnce(
            new Error(
              'Could not establish connection. Receiving end does not exist.'
            )
          ),
        pingToolbar,
        showToolbar,
        notifyActivationFailure,
      })
    );

    const result = await controller.handleInvocation(
      createInvocation({
        intent: 'open-and-export',
        source: 'context-menu-export-snapshot',
        tab: {
          id: 33,
          url: 'https://example.com',
        } as ActivationInvocation['tab'],
      })
    );

    expect(result).toMatchObject({
      ok: true,
      tabId: 33,
      action: 'opened',
      changed: true,
    });
    expect(showToolbar).toHaveBeenCalledWith(33);
    expect(notifyActivationFailure).not.toHaveBeenCalled();
    expect(pingToolbar).toHaveBeenCalledTimes(6);
  });

  it('toggles using assumed legacy state when status probes are unavailable', async () => {
    const receiverError = new Error(
      'Could not establish connection. Receiving end does not exist.'
    );
    const getToolbarStatus = vi.fn().mockRejectedValue(receiverError);
    const pingToolbar = vi.fn().mockRejectedValue(receiverError);
    const showToolbar = vi.fn().mockResolvedValue(undefined);
    const toggleToolbar = vi.fn().mockResolvedValue(undefined);
    const notifyActivationFailure = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({
        getToolbarStatus,
        pingToolbar,
        showToolbar,
        toggleToolbar,
        notifyActivationFailure,
      })
    );

    const invocation = createInvocation({
      intent: 'toggle',
      tab: {
        id: 61,
        url: 'https://example.com',
      } as ActivationInvocation['tab'],
    });

    const first = await controller.handleInvocation(invocation);
    const second = await controller.handleInvocation(invocation);

    expect(first).toMatchObject({
      ok: true,
      tabId: 61,
      action: 'opened',
    });
    expect(second).toMatchObject({
      ok: true,
      tabId: 61,
      action: 'closed',
    });
    expect(showToolbar).toHaveBeenCalledTimes(1);
    expect(toggleToolbar).toHaveBeenCalledWith(61, false);
    expect(notifyActivationFailure).not.toHaveBeenCalled();
  });

  it('clears assumed legacy toggle state for a tab', async () => {
    const receiverError = new Error(
      'Could not establish connection. Receiving end does not exist.'
    );
    const getToolbarStatus = vi.fn().mockRejectedValue(receiverError);
    const pingToolbar = vi.fn().mockRejectedValue(receiverError);
    const showToolbar = vi.fn().mockResolvedValue(undefined);
    const toggleToolbar = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({
        getToolbarStatus,
        pingToolbar,
        showToolbar,
        toggleToolbar,
      })
    );

    const invocation = createInvocation({
      intent: 'toggle',
      tab: {
        id: 44,
        url: 'https://example.com',
      } as ActivationInvocation['tab'],
    });

    const first = await controller.handleInvocation(invocation);
    controller.clearTabState(44);
    const second = await controller.handleInvocation(invocation);

    expect(first.action).toBe('opened');
    expect(second.action).toBe('opened');
    expect(showToolbar).toHaveBeenCalledTimes(2);
    expect(toggleToolbar).not.toHaveBeenCalled();
    expect(pingToolbar).toHaveBeenCalledTimes(12);
    expect(getToolbarStatus).toHaveBeenCalledTimes(2);
  });

  it('reports failure when legacy fallback cannot show toolbar', async () => {
    const pingToolbar = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Could not establish connection. Receiving end does not exist.'
        )
      );
    const showToolbar = vi.fn().mockResolvedValue({mounted: false});
    const notifyActivationFailure = vi.fn().mockResolvedValue(undefined);

    const controller = new ActivationController(
      createDeps({
        getToolbarStatus: vi
          .fn()
          .mockRejectedValueOnce(
            new Error(
              'Could not establish connection. Receiving end does not exist.'
            )
          ),
        pingToolbar,
        showToolbar,
        notifyActivationFailure,
      })
    );

    const result = await controller.handleInvocation(
      createInvocation({
        intent: 'open',
        tab: {
          id: 73,
          url: 'https://example.com',
        } as ActivationInvocation['tab'],
      })
    );

    expect(result.reason).toBe('show-failed');
    expect(notifyActivationFailure).toHaveBeenCalledWith(73, 'show-failed');
  });
});
