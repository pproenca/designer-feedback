/**
 * Global Window augmentations for E2E tests.
 * These properties are set by the extension during activation.
 */
declare global {
  interface Window {
    __dfActivateStatus?: string;
    __dfActivateDebug?: string;
    __designerFeedbackInjected?: boolean;
    chrome?: {
      scripting?: unknown;
    };
  }
}

export {};
