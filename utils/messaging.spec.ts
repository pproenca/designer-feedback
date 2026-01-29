import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { sendMessage } from './messaging';

describe('sendMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves normally when response arrives before timeout', async () => {
    const expectedResponse = { data: 'test' };

    // Use vi.spyOn to mock the sendMessage behavior
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(expectedResponse as unknown as void);

    const result = await sendMessage({ type: 'TEST' });
    expect(result).toEqual(expectedResponse);

    spy.mockRestore();
  });

  it('rejects with timeout error when no response within specified time', async () => {
    // Mock sendMessage to never resolve
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const promise = sendMessage({ type: 'TEST' }, 1000);

    // Advance timers past the timeout
    vi.advanceTimersByTime(1100);

    await expect(promise).rejects.toThrow('Message timeout');
    spy.mockRestore();
  });

  it('uses default 30 second timeout when not specified', async () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

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

    spy.mockRestore();
  });

  it('allows custom timeout to be specified', async () => {
    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const promise = sendMessage({ type: 'TEST' }, 5000);

    // Advance timers past custom timeout
    vi.advanceTimersByTime(5100);

    await expect(promise).rejects.toThrow('Message timeout');
    spy.mockRestore();
  });

  it('does not reject after response is received even if timer fires', async () => {
    const expectedResponse = { data: 'test' };

    const spy = vi.spyOn(browser.runtime, 'sendMessage').mockResolvedValue(expectedResponse as unknown as void);

    // Get response immediately
    const result = await sendMessage({ type: 'TEST' }, 1000);

    // Advance timers past the timeout - should not cause rejection
    vi.advanceTimersByTime(2000);

    // Result should still be the expected response
    expect(result).toEqual(expectedResponse);
    spy.mockRestore();
  });
});
