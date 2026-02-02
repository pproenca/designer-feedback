/**
 * Global Window augmentations for E2E tests.
 * These properties are set by the extension during activation.
 */

export interface DfActivateDebug {
  mode?: 'auto';
  targetOrigin?: string;
  targetUrl?: string;
  tabs?: string[];
  scriptFiles?: string[];
  injectionResult?: unknown;
  injectionError?: string;
  flagCheck?: unknown;
  toolbarShown?: boolean;
  error?: string;
  reason?: string;
}

declare global {
  interface Window {
    __dfActivateStatus?: string;
    __dfActivateDebug?: DfActivateDebug;
    __designerFeedbackInjected?: boolean;
    chrome?: {
      scripting?: unknown;
    };
  }
}

export {};
