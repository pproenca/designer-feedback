import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {withTimeout} from './messaging';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves normally when promise resolves before timeout', async () => {
    const expectedResponse = {data: 'test'};
    const promise = Promise.resolve(expectedResponse);

    const result = await withTimeout(promise, 1000);
    expect(result).toEqual(expectedResponse);
  });

  it('rejects with timeout error when promise does not resolve within specified time', async () => {
    // Create a promise that never resolves
    const neverResolves = new Promise(() => {});

    const promise = withTimeout(neverResolves, 1000);

    // Advance timers past the timeout
    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('Message timeout');
  });

  it('uses default 30 second timeout when not specified', async () => {
    const neverResolves = new Promise(() => {});

    const promise = withTimeout(neverResolves);

    // Advance timers to just before default timeout
    vi.advanceTimersByTime(29999);

    // Promise should still be pending
    let resolved = false;
    let rejected = false;
    promise.then(() => (resolved = true)).catch(() => (rejected = true));

    // Now advance past timeout
    await vi.runAllTimersAsync();

    // Now it should be rejected
    expect(rejected).toBe(true);
    expect(resolved).toBe(false);
  });

  it('allows custom timeout to be specified', async () => {
    const neverResolves = new Promise(() => {});

    const promise = withTimeout(neverResolves, 5000);

    // Advance timers past custom timeout
    vi.advanceTimersByTime(5100);

    await expect(promise).rejects.toThrow('Message timeout');
  });

  it('does not reject after promise resolves even if timer would fire later', async () => {
    const expectedResponse = {data: 'test'};
    const promise = Promise.resolve(expectedResponse);

    // Get response immediately
    const result = await withTimeout(promise, 1000);

    // Advance timers past the timeout - should not cause rejection
    vi.advanceTimersByTime(2000);

    // Result should still be the expected response
    expect(result).toEqual(expectedResponse);
  });

  it('propagates original error when promise rejects before timeout', async () => {
    const originalError = new Error('Original error');
    const failingPromise = Promise.reject(originalError);

    await expect(withTimeout(failingPromise, 1000)).rejects.toThrow(
      'Original error'
    );
  });
});
