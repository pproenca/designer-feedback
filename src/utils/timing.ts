// =============================================================================
// Timing Utilities (Throttle/Debounce)
// =============================================================================

/**
 * Creates a throttled function that only invokes the provided function at most
 * once per the specified interval. Trailing calls are executed after the interval.
 *
 * @param fn - The function to throttle
 * @param intervalMs - Minimum time between function invocations in milliseconds
 * @returns A throttled version of the function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number
): T {
  let lastCallTime = 0;
  let trailingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let trailingArgs: Parameters<T> | null = null;
  let trailingThis: unknown = null;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    // Store context and args for potential trailing call
    trailingThis = this;
    trailingArgs = args;

    if (timeSinceLastCall >= intervalMs) {
      // Enough time has passed, execute immediately
      lastCallTime = now;
      trailingArgs = null;

      // Clear any pending trailing call
      if (trailingTimeoutId !== null) {
        clearTimeout(trailingTimeoutId);
        trailingTimeoutId = null;
      }

      return fn.apply(this, args);
    }

    // Schedule trailing call if not already scheduled
    if (trailingTimeoutId === null) {
      const remainingTime = intervalMs - timeSinceLastCall;
      trailingTimeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        trailingTimeoutId = null;
        if (trailingArgs !== null) {
          fn.apply(trailingThis, trailingArgs);
          trailingArgs = null;
        }
      }, remainingTime);
    }

    return undefined;
  } as T;

  return throttled;
}

/**
 * Creates a debounced function that delays invoking the provided function
 * until after the specified delay has elapsed since the last invocation.
 *
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds before invoking the function
 * @returns A debounced version of the function with a cancel method
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;
  let pendingThis: unknown = null;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    pendingArgs = args;
    pendingThis = this;

    // Clear previous timeout
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    // Schedule new timeout
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (pendingArgs !== null) {
        fn.apply(pendingThis, pendingArgs);
        pendingArgs = null;
      }
    }, delayMs);
  } as T & { cancel: () => void };

  // Add cancel method
  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingArgs = null;
  };

  return debounced;
}
