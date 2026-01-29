import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll import after implementing
// import { throttle, debounce } from './timing';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls function immediately on first invocation', async () => {
    // Dynamic import to avoid errors before implementation exists
    const { throttle } = await import('./timing');

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores calls within throttle interval', async () => {
    const { throttle } = await import('./timing');

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows calls after throttle interval passes', async () => {
    const { throttle } = await import('./timing');

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(101);

    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('preserves function arguments', async () => {
    const { throttle } = await import('./timing');

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('arg1', 'arg2');
    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('preserves this context', async () => {
    const { throttle } = await import('./timing');

    const obj = {
      value: 42,
      fn: vi.fn(function (this: { value: number }) {
        return this.value;
      }),
    };

    const throttled = throttle(obj.fn, 100);
    throttled.call(obj);

    expect(obj.fn).toHaveBeenCalled();
    expect(obj.fn.mock.instances[0]).toBe(obj);
  });

  it('executes trailing call after interval', async () => {
    const { throttle } = await import('./timing');

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('first');
    throttled('second');
    throttled('third');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');

    vi.advanceTimersByTime(101);

    // Trailing call should execute with last args
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('third');
  });

  it('provides cancel method to abort trailing execution', async () => {
    const { throttle } = await import('./timing');

    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('first');
    throttled('second');
    throttled.cancel();

    vi.advanceTimersByTime(101);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays execution until quiet period', async () => {
    const { debounce } = await import('./timing');

    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(101);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on subsequent calls', async () => {
    const { debounce } = await import('./timing');

    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);

    debounced(); // Reset timer
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled(); // Still waiting

    vi.advanceTimersByTime(51);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('preserves function arguments', async () => {
    const { debounce } = await import('./timing');

    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(101);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('uses last call arguments when multiple calls made', async () => {
    const { debounce } = await import('./timing');

    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(101);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('provides cancel method to abort pending execution', async () => {
    const { debounce } = await import('./timing');

    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();

    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('preserves this context', async () => {
    const { debounce } = await import('./timing');

    const obj = {
      value: 42,
      fn: vi.fn(function (this: { value: number }) {
        return this.value;
      }),
    };

    const debounced = debounce(obj.fn, 100);
    debounced.call(obj);

    vi.advanceTimersByTime(101);

    expect(obj.fn).toHaveBeenCalled();
    expect(obj.fn.mock.instances[0]).toBe(obj);
  });
});
