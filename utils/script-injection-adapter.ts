import {browser} from 'wxt/browser';

const RESTRICTED_ACCESS_ERROR_PATTERNS = [
  'cannot access contents of the page',
  'missing host permission',
  'activetab',
  'not allowed to access',
  'permission is required',
  'cannot access a chrome://',
  'extensions gallery cannot be scripted',
];

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

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRestrictedAccessError(error: unknown): boolean {
  const message = normalizeErrorMessage(error).toLowerCase();
  return RESTRICTED_ACCESS_ERROR_PATTERNS.some(pattern =>
    message.includes(pattern)
  );
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

      const legacyTabs = extensionBrowser.tabs as
        | TabsWithLegacyExecuteScript
        | undefined;
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
