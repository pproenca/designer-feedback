import {describe, expect, it, vi} from 'vitest';
import {createToolbarLifecycle, type MountedToolbar} from './toolbar-lifecycle';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

describe('toolbar-lifecycle', () => {
  it('mounts once when enable is called repeatedly', async () => {
    const toolbar: MountedToolbar = {remove: vi.fn()};
    const mountToolbar = vi.fn(async () => toolbar);
    const lifecycle = createToolbarLifecycle(mountToolbar);

    await lifecycle.enable();
    await lifecycle.enable();

    expect(mountToolbar).toHaveBeenCalledTimes(1);
    expect(toolbar.remove).not.toHaveBeenCalled();
  });

  it('unmounts when disable is called after mount', async () => {
    const toolbar: MountedToolbar = {remove: vi.fn()};
    const mountToolbar = vi.fn(async () => toolbar);
    const lifecycle = createToolbarLifecycle(mountToolbar);

    await lifecycle.enable();
    lifecycle.disable();
    lifecycle.disable();

    expect(toolbar.remove).toHaveBeenCalledTimes(1);
  });

  it('does not keep mounted UI when disabled during pending mount', async () => {
    const firstToolbar: MountedToolbar = {remove: vi.fn()};
    const secondToolbar: MountedToolbar = {remove: vi.fn()};
    const deferred = createDeferred<MountedToolbar>();
    const mountToolbar = vi
      .fn<() => Promise<MountedToolbar>>()
      .mockImplementationOnce(() => deferred.promise)
      .mockImplementationOnce(async () => secondToolbar);

    const lifecycle = createToolbarLifecycle(mountToolbar);

    const pendingEnable = lifecycle.enable();
    lifecycle.disable();
    deferred.resolve(firstToolbar);
    await pendingEnable;

    expect(firstToolbar.remove).toHaveBeenCalledTimes(1);

    await lifecycle.enable();
    expect(mountToolbar).toHaveBeenCalledTimes(2);
    expect(secondToolbar.remove).not.toHaveBeenCalled();
  });

  it('re-mounts after disable followed by enable', async () => {
    const firstToolbar: MountedToolbar = {remove: vi.fn()};
    const secondToolbar: MountedToolbar = {remove: vi.fn()};
    const mountToolbar = vi
      .fn<() => Promise<MountedToolbar>>()
      .mockImplementationOnce(async () => firstToolbar)
      .mockImplementationOnce(async () => secondToolbar);

    const lifecycle = createToolbarLifecycle(mountToolbar);

    await lifecycle.enable();
    lifecycle.disable();
    await lifecycle.enable();

    expect(mountToolbar).toHaveBeenCalledTimes(2);
    expect(firstToolbar.remove).toHaveBeenCalledTimes(1);
    expect(secondToolbar.remove).not.toHaveBeenCalled();
  });

  it('exposes mounted status transitions', async () => {
    const toolbar: MountedToolbar = {remove: vi.fn()};
    const mountToolbar = vi.fn(async () => toolbar);
    const lifecycle = createToolbarLifecycle(mountToolbar);

    expect(lifecycle.isMounted()).toBe(false);

    await lifecycle.enable();
    expect(lifecycle.isMounted()).toBe(true);

    lifecycle.disable();
    expect(lifecycle.isMounted()).toBe(false);
  });
});
