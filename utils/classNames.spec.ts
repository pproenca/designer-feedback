import { describe, it, expect } from 'vitest';

describe('classNames', () => {
  it('joins string arguments with spaces', async () => {
    const { classNames } = await import('./classNames');

    expect(classNames('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values (false, null, undefined, empty string)', async () => {
    const { classNames } = await import('./classNames');

    expect(classNames('foo', false, null, undefined, '', 'bar')).toBe('foo bar');
  });

  it('flattens arrays of strings', async () => {
    const { classNames } = await import('./classNames');

    expect(classNames('foo', ['bar', 'baz'], 'qux')).toBe('foo bar baz qux');
  });

  it('filters falsy values within arrays', async () => {
    const { classNames } = await import('./classNames');

    expect(classNames(['foo', false, 'bar'], null, ['baz', undefined])).toBe(
      'foo bar baz'
    );
  });

  it('returns empty string when given no arguments', async () => {
    const { classNames } = await import('./classNames');

    expect(classNames()).toBe('');
  });

  it('returns empty string when all arguments are falsy', async () => {
    const { classNames } = await import('./classNames');

    expect(classNames(false, null, undefined, '', [])).toBe('');
  });

  it('handles single string argument', async () => {
    const { classNames } = await import('./classNames');

    expect(classNames('single')).toBe('single');
  });

  it('handles boolean false from conditional expressions', async () => {
    const { classNames } = await import('./classNames');
    const isActive = false;
    const isDisabled = true;

    expect(
      classNames('base', isActive && 'active', isDisabled && 'disabled')
    ).toBe('base disabled');
  });

  it('handles conditional ternary expressions', async () => {
    const { classNames } = await import('./classNames');
    const variant: 'primary' | 'secondary' = 'primary';

    expect(
      classNames('btn', variant === 'primary' ? 'btn-primary' : 'btn-secondary')
    ).toBe('btn btn-primary');
  });

  it('preserves whitespace within individual class strings', async () => {
    const { classNames } = await import('./classNames');

    // Note: classNames should treat each argument as-is, so multi-class strings work
    expect(classNames('foo bar', 'baz qux')).toBe('foo bar baz qux');
  });
});
