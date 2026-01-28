import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '../test/setup';

// Import after mocks are set up
import { sendMessage } from './messaging';

describe('sendMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves normally when response arrives before timeout', async () => {
    const expectedResponse = { data: 'test' };
    mockChrome.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback: (response: unknown) => void) => {
        // Simulate immediate response
        callback(expectedResponse);
      }
    );

    const result = await sendMessage({ type: 'TEST' });
    expect(result).toEqual(expectedResponse);
  });

  it('rejects with timeout error when no response within specified time', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(() => {
      // Never call callback - simulates service worker not responding
    });

    const promise = sendMessage({ type: 'TEST' }, 1000);

    // Advance timers past the timeout
    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('Message timeout');
  });

  it('uses default 30 second timeout when not specified', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(() => {
      // Never call callback
    });

    const promise = sendMessage({ type: 'TEST' });

    // Advance timers to just before default timeout
    vi.advanceTimersByTime(29999);

    // Promise should still be pending
    let resolved = false;
    let rejected = false;
    promise.then(() => (resolved = true)).catch(() => (rejected = true));

    // Allow microtasks to run
    await vi.runAllTimersAsync();

    // Now it should be rejected (we advanced past 30s above)
    expect(rejected).toBe(true);
    expect(resolved).toBe(false);
  });

  it('allows custom timeout to be specified', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(() => {
      // Never call callback
    });

    const promise = sendMessage({ type: 'TEST' }, 5000);

    // Advance timers past custom timeout
    vi.advanceTimersByTime(5100);

    await expect(promise).rejects.toThrow('Message timeout');
  });

  it('rejects with chrome runtime error if present', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback: (response: unknown) => void) => {
        mockChrome.runtime.lastError = { message: 'Extension context invalidated' };
        callback(undefined);
      }
    );

    await expect(sendMessage({ type: 'TEST' })).rejects.toThrow(
      'Extension context invalidated'
    );
  });

  it('clears timeout when response is received', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const expectedResponse = { data: 'test' };

    mockChrome.runtime.sendMessage.mockImplementation(
      (_message: unknown, callback: (response: unknown) => void) => {
        callback(expectedResponse);
      }
    );

    await sendMessage({ type: 'TEST' });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
