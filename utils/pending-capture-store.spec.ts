import {describe, expect, it, vi} from 'vitest';
import {
  createPendingCaptureStoreAdapter,
  type PendingCaptureStoreValue,
} from './pending-capture-store';

function createStore(initial: PendingCaptureStoreValue = {}) {
  let value = initial;
  return {
    getValue: vi.fn(async () => value),
    setValue: vi.fn(async (next: PendingCaptureStoreValue) => {
      value = next;
    }),
  };
}

describe('pending capture store adapter', () => {
  it('reads from session store when available', async () => {
    const sessionStore = createStore({
      '1': {requestId: 'a', format: 'snapshot', createdAt: 1},
    });
    const fallbackStore = createStore({
      '2': {requestId: 'b', format: 'snapshot', createdAt: 2},
    });
    const warn = vi.fn();
    const adapter = createPendingCaptureStoreAdapter({
      sessionStore,
      fallbackStore,
      warn,
    });

    const value = await adapter.getValue();

    expect(value).toEqual({
      '1': {requestId: 'a', format: 'snapshot', createdAt: 1},
    });
    expect(warn).not.toHaveBeenCalled();
    expect(fallbackStore.getValue).not.toHaveBeenCalled();
  });

  it('falls back to local store when session get fails', async () => {
    const sessionStore = createStore();
    sessionStore.getValue.mockRejectedValue(new Error('session unavailable'));
    const fallbackStore = createStore({
      '2': {requestId: 'b', format: 'snapshot', createdAt: 2},
    });
    const warn = vi.fn();
    const adapter = createPendingCaptureStoreAdapter({
      sessionStore,
      fallbackStore,
      warn,
    });

    const value = await adapter.getValue();

    expect(value).toEqual({
      '2': {requestId: 'b', format: 'snapshot', createdAt: 2},
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(fallbackStore.getValue).toHaveBeenCalledTimes(1);
  });

  it('writes to local fallback when session set fails', async () => {
    const sessionStore = createStore();
    sessionStore.setValue.mockRejectedValue(new Error('session unavailable'));
    const fallbackStore = createStore();
    const warn = vi.fn();
    const adapter = createPendingCaptureStoreAdapter({
      sessionStore,
      fallbackStore,
      warn,
    });

    await adapter.setValue({
      '3': {requestId: 'c', format: 'snapshot', createdAt: 3},
    });

    expect(sessionStore.setValue).toHaveBeenCalledTimes(1);
    expect(fallbackStore.setValue).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns empty object when both stores fail on read', async () => {
    const sessionStore = createStore();
    sessionStore.getValue.mockRejectedValue(new Error('session unavailable'));
    const fallbackStore = createStore();
    fallbackStore.getValue.mockRejectedValue(new Error('local unavailable'));
    const warn = vi.fn();
    const adapter = createPendingCaptureStoreAdapter({
      sessionStore,
      fallbackStore,
      warn,
    });

    const value = await adapter.getValue();

    expect(value).toEqual({});
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
