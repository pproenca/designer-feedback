import {describe, expect, it, vi} from 'vitest';
import {
  ScriptInjectionError,
  createScriptInjectionAdapter,
} from './script-injection-adapter';

describe('script injection adapter', () => {
  it('throws no-files when files list is empty', async () => {
    const adapter = createScriptInjectionAdapter({} as never);

    await expect(adapter.injectFiles(1, [])).rejects.toMatchObject({
      name: 'ScriptInjectionError',
      code: 'no-files',
    });
  });

  it('uses scripting.executeScript when available', async () => {
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const adapter = createScriptInjectionAdapter({
      scripting: {executeScript},
    } as never);

    await adapter.injectFiles(7, ['content-scripts/content.js']);

    expect(executeScript).toHaveBeenCalledWith({
      target: {tabId: 7},
      files: ['content-scripts/content.js'],
    });
  });

  it('falls back to tabs.executeScript when scripting API is unavailable', async () => {
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const adapter = createScriptInjectionAdapter({
      tabs: {executeScript},
    } as never);

    await adapter.injectFiles(5, ['a.js', 'b.js']);

    expect(executeScript).toHaveBeenNthCalledWith(1, 5, {file: 'a.js'});
    expect(executeScript).toHaveBeenNthCalledWith(2, 5, {file: 'b.js'});
  });

  it('throws api-unavailable when neither API is present', async () => {
    const adapter = createScriptInjectionAdapter({} as never);

    await expect(adapter.injectFiles(7, ['content.js'])).rejects.toMatchObject({
      name: 'ScriptInjectionError',
      code: 'api-unavailable',
    });
  });

  it('normalizes restricted-access errors', async () => {
    const executeScript = vi
      .fn()
      .mockRejectedValue(new Error('Missing host permission for this tab'));
    const adapter = createScriptInjectionAdapter({
      scripting: {executeScript},
    } as never);

    await expect(adapter.injectFiles(9, ['content.js'])).rejects.toMatchObject({
      name: 'ScriptInjectionError',
      code: 'restricted-access',
    });
  });

  it('normalizes generic execution errors', async () => {
    const executeScript = vi
      .fn()
      .mockRejectedValue(new Error('Unexpected injection failure'));
    const adapter = createScriptInjectionAdapter({
      scripting: {executeScript},
    } as never);

    await expect(adapter.injectFiles(11, ['content.js'])).rejects.toMatchObject(
      {
        name: 'ScriptInjectionError',
        code: 'execution-failed',
      }
    );
  });

  it('keeps original cause message on wrapped errors', async () => {
    const executeScript = vi
      .fn()
      .mockRejectedValue(new Error('Cannot access contents of the page'));
    const adapter = createScriptInjectionAdapter({
      scripting: {executeScript},
    } as never);

    await expect(adapter.injectFiles(12, ['content.js'])).rejects.toSatisfy(
      error =>
        error instanceof ScriptInjectionError &&
        error.causeMessage === 'Cannot access contents of the page'
    );
  });
});
