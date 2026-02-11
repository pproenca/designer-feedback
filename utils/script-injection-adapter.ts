import {browser} from 'wxt/browser';
import {
  isRestrictedAccessError,
  normalizeErrorMessage,
} from '@/utils/error-patterns';

export type ScriptInjectionErrorCode =
  | 'no-files'
  | 'api-unavailable'
  | 'restricted-access'
  | 'execution-failed';

export class ScriptInjectionError extends Error {
  constructor(
    readonly code: ScriptInjectionErrorCode,
    message: string,
    readonly causeMessage?: string
  ) {
    super(message);
    this.name = 'ScriptInjectionError';
  }
}

export interface ScriptInjectionAdapter {
  injectFiles(tabId: number, files: string[]): Promise<void>;
}

type ExtensionBrowser = typeof browser;

type TabsWithLegacyExecuteScript = {
  executeScript?: (
    tabId: number,
    details: {
      file: string;
    }
  ) => Promise<unknown>;
};

export function createScriptInjectionAdapter(
  extensionBrowser: ExtensionBrowser = browser
): ScriptInjectionAdapter {
  return {
    async injectFiles(tabId: number, files: string[]): Promise<void> {
      if (!files.length) {
        throw new ScriptInjectionError(
          'no-files',
          '[script-injection:no-files] No content script files configured'
        );
      }

      const tryScriptingApi = extensionBrowser.scripting?.executeScript;
      if (tryScriptingApi) {
        try {
          await tryScriptingApi({target: {tabId}, files});
          return;
        } catch (error) {
          const code: ScriptInjectionErrorCode = isRestrictedAccessError(error)
            ? 'restricted-access'
            : 'execution-failed';
          const originalMessage = normalizeErrorMessage(error);
          throw new ScriptInjectionError(
            code,
            `[script-injection:${code}] ${originalMessage}`,
            originalMessage
          );
        }
      }

      const legacyTabs: TabsWithLegacyExecuteScript | undefined =
        extensionBrowser.tabs;
      if (legacyTabs && typeof legacyTabs.executeScript === 'function') {
        try {
          for (const file of files) {
            await legacyTabs.executeScript(tabId, {file});
          }
          return;
        } catch (error) {
          const code: ScriptInjectionErrorCode = isRestrictedAccessError(error)
            ? 'restricted-access'
            : 'execution-failed';
          const originalMessage = normalizeErrorMessage(error);
          throw new ScriptInjectionError(
            code,
            `[script-injection:${code}] ${originalMessage}`,
            originalMessage
          );
        }
      }

      throw new ScriptInjectionError(
        'api-unavailable',
        '[script-injection:api-unavailable] No supported script injection API available'
      );
    },
  };
}
