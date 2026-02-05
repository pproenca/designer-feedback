import {describe, expect, it} from 'vitest';
import {
  clearToolbarEnabledForTab,
  isToolbarEnabledForTab,
  setToolbarEnabledForTab,
} from './toolbar-toggle-state';

describe('toolbar-toggle-state', () => {
  it('defaults to disabled when tab has no stored state', () => {
    expect(isToolbarEnabledForTab({}, 123)).toBe(false);
  });

  it('enables a tab when set to true', () => {
    const next = setToolbarEnabledForTab({}, 7, true);
    expect(next).toEqual({'7': true});
    expect(isToolbarEnabledForTab(next, 7)).toBe(true);
  });

  it('disables a tab by clearing its stored key', () => {
    const current = {'7': true};
    const next = setToolbarEnabledForTab(current, 7, false);
    expect(next).toEqual({});
    expect(isToolbarEnabledForTab(next, 7)).toBe(false);
  });

  it('clears unknown tab ids as a no-op', () => {
    const current = {'5': true};
    const next = clearToolbarEnabledForTab(current, 42);
    expect(next).toBe(current);
  });
});
