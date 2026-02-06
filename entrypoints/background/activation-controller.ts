import type {Browser} from 'wxt/browser';
import {contentMessenger} from '@/utils/messaging';
import {
  getContentScriptFiles,
  isInjectableUrl,
} from '@/utils/background-helpers';
import {createActivationTrace, type ActivationTrace} from './activation-trace';
import type {
  ActivationFailureReason,
  ActivationIntent,
  ActivationResult,
  ActivationSource,
} from './activation-types';

export interface ActivationInvocation {
  source: ActivationSource;
  intent: ActivationIntent;
  tab: Browser.tabs.Tab | undefined;
  pageUrl?: string;
}

type ToolbarStatus = {mounted: boolean};
type ToolbarAck = {mounted: boolean} | undefined;

type StatusCheckResult =
  | {ok: true; mounted: boolean}
  | {ok: false; reason: 'no-receiver' | 'restricted' | 'other'};

type EnsureReadyResult =
  | {ok: true; mounted: boolean}
  | {ok: false; reason: ActivationFailureReason};

interface ToolbarCommandOptions {
  allowLegacyUndefinedAck?: boolean;
}

export interface ActivationControllerDeps {
  readonly getContentScriptFiles: () => string[];
  readonly isInjectableUrl: (url: string) => boolean;
  readonly getToolbarStatus: (tabId: number) => Promise<ToolbarStatus>;
  readonly pingToolbar: (tabId: number) => Promise<{ready: true}>;
  readonly showToolbar: (tabId: number) => Promise<ToolbarAck>;
  readonly toggleToolbar: (
    tabId: number,
    enabled: boolean
  ) => Promise<ToolbarAck>;
  readonly executeScript: (tabId: number, files: string[]) => Promise<void>;
  readonly notifyActivationFailure: (
    tabId: number | undefined,
    reason: ActivationFailureReason
  ) => Promise<void> | void;
  readonly sleep: (ms: number) => Promise<void>;
  readonly createTrace: (
    source: ActivationSource,
    intent: ActivationIntent,
    tabId: number | undefined
  ) => ActivationTrace;
}

const NO_RECEIVER_ERROR_PATTERNS = [
  'receiving end does not exist',
  'could not establish connection',
  'message port closed before a response was received',
];

const RESTRICTED_ACCESS_ERROR_PATTERNS = [
  'cannot access contents of the page',
  'missing host permission',
  'activetab',
  'not allowed to access',
  'permission is required',
  'cannot access a chrome://',
  'extensions gallery cannot be scripted',
];

const DEFAULT_ACTION_TITLE = 'Click to toggle Designer Feedback';
const WARNING_BADGE_COLOR = '#D97706';
const WARNING_BADGE_TEXT = '!';
const WARNING_BADGE_DURATION_MS = 3500;
const READINESS_RETRY_DELAYS_MS = [0, 25, 50, 100, 180, 300];

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }
  return String(error).toLowerCase();
}

function isNoReceiverError(error: unknown): boolean {
  const message = errorMessage(error);
  return NO_RECEIVER_ERROR_PATTERNS.some(pattern => message.includes(pattern));
}

function isRestrictedAccessError(error: unknown): boolean {
  const message = errorMessage(error);
  return RESTRICTED_ACCESS_ERROR_PATTERNS.some(pattern =>
    message.includes(pattern)
  );
}

function getActivationFailureTitle(reason: ActivationFailureReason): string {
  const labels: Record<ActivationFailureReason, string> = {
    'missing-tab-id': 'no active tab',
    'restricted-url': 'restricted page',
    'injection-failed': 'injection failed',
    'readiness-timeout': 'content script timeout',
    'show-failed': 'toolbar open failed',
    'hide-failed': 'toolbar close failed',
    'status-check-failed': 'toolbar status unavailable',
    unknown: 'unknown error',
  };

  return `Designer Feedback unavailable (${labels[reason]})`;
}

async function notifyActivationFailureDefault(
  tabId: number | undefined,
  reason: ActivationFailureReason
): Promise<void> {
  const actionScope = tabId ? {tabId} : {};

  try {
    await browser.action.setBadgeText({
      ...actionScope,
      text: WARNING_BADGE_TEXT,
    });
    await browser.action.setBadgeBackgroundColor({
      ...actionScope,
      color: WARNING_BADGE_COLOR,
    });
    await browser.action.setTitle({
      ...actionScope,
      title: getActivationFailureTitle(reason),
    });

    setTimeout(() => {
      void browser.action.setBadgeText({...actionScope, text: ''});
      void browser.action.setTitle({
        ...actionScope,
        title: DEFAULT_ACTION_TITLE,
      });
    }, WARNING_BADGE_DURATION_MS);
  } catch (error) {
    console.warn('Failed to notify toolbar activation failure:', error);
  }
}

const defaultDeps: ActivationControllerDeps = {
  getContentScriptFiles,
  isInjectableUrl,
  getToolbarStatus: tabId =>
    contentMessenger.sendMessage('getToolbarStatus', undefined, tabId),
  pingToolbar: tabId =>
    contentMessenger.sendMessage('pingToolbar', undefined, tabId),
  showToolbar: tabId =>
    contentMessenger.sendMessage('showToolbar', undefined, tabId),
  toggleToolbar: (tabId, enabled) =>
    contentMessenger.sendMessage('toggleToolbar', enabled, tabId),
  executeScript: async (tabId, files) => {
    if (!browser.scripting?.executeScript) {
      throw new Error('Scripting API unavailable');
    }

    if (!files.length) {
      throw new Error('No content script files configured');
    }

    await browser.scripting.executeScript({target: {tabId}, files});
  },
  notifyActivationFailure: notifyActivationFailureDefault,
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  createTrace: createActivationTrace,
};

export class ActivationController {
  private readonly legacyMountedTabs = new Set<number>();

  constructor(private readonly deps: ActivationControllerDeps = defaultDeps) {}

  clearTabState(tabId: number): void {
    this.legacyMountedTabs.delete(tabId);
  }

  async handleInvocation(
    invocation: ActivationInvocation
  ): Promise<ActivationResult> {
    const tabId = invocation.tab?.id;
    const trace = this.deps.createTrace(
      invocation.source,
      invocation.intent,
      tabId
    );
    trace.step('invoked', {
      hasTabId: Boolean(tabId),
      hasTabUrl: Boolean(invocation.tab?.url),
      hasPendingUrl: Boolean(invocation.tab?.pendingUrl),
      hasPageUrl: Boolean(invocation.pageUrl),
    });

    if (!tabId) {
      return await this.fail(trace, undefined, 'missing-tab-id');
    }

    const targetUrl =
      invocation.tab?.url ?? invocation.tab?.pendingUrl ?? invocation.pageUrl;

    trace.step('resolved-target', {
      tabId,
      targetUrl: targetUrl ?? null,
    });

    if (targetUrl && !this.deps.isInjectableUrl(targetUrl)) {
      return await this.fail(trace, tabId, 'restricted-url', {
        targetUrl,
      });
    }

    const ready = await this.ensureContentReady(tabId, trace);
    if (!ready.ok) {
      const legacyFallback = await this.tryLegacyProtocolFallback(
        tabId,
        invocation.intent,
        ready.reason,
        trace
      );
      if (legacyFallback) {
        return legacyFallback;
      }
      return await this.fail(trace, tabId, ready.reason);
    }

    if (ready.mounted) {
      this.legacyMountedTabs.add(tabId);
    } else {
      this.legacyMountedTabs.delete(tabId);
    }

    if (invocation.intent === 'toggle') {
      if (ready.mounted) {
        return await this.hideToolbar(tabId, trace);
      }
      return await this.showToolbar(tabId, trace);
    }

    if (ready.mounted) {
      trace.step('completed', {tabId, action: 'noop'});
      return {
        ok: true,
        tabId,
        action: 'noop',
        changed: false,
      };
    }

    return await this.showToolbar(tabId, trace);
  }

  private async showToolbar(
    tabId: number,
    trace: ActivationTrace,
    options: ToolbarCommandOptions = {}
  ): Promise<ActivationResult> {
    trace.step('show-sent', {tabId, enabled: true});

    try {
      const response = await this.deps.showToolbar(tabId);
      if (
        response?.mounted === true ||
        (options.allowLegacyUndefinedAck && response === undefined)
      ) {
        this.legacyMountedTabs.add(tabId);
        trace.step('completed', {tabId, action: 'opened'});
        return {
          ok: true,
          tabId,
          action: 'opened',
          changed: true,
        };
      }
    } catch (error) {
      trace.step('show-sent', {
        tabId,
        enabled: true,
        error: String(error),
      });
      if (isRestrictedAccessError(error)) {
        return await this.fail(trace, tabId, 'restricted-url');
      }
    }

    return await this.fail(trace, tabId, 'show-failed');
  }

  private async hideToolbar(
    tabId: number,
    trace: ActivationTrace,
    options: ToolbarCommandOptions = {}
  ): Promise<ActivationResult> {
    trace.step('show-sent', {tabId, enabled: false});

    try {
      const response = await this.deps.toggleToolbar(tabId, false);
      if (
        response?.mounted === false ||
        (options.allowLegacyUndefinedAck && response === undefined)
      ) {
        this.legacyMountedTabs.delete(tabId);
        trace.step('completed', {tabId, action: 'closed'});
        return {
          ok: true,
          tabId,
          action: 'closed',
          changed: true,
        };
      }
    } catch (error) {
      if (isNoReceiverError(error)) {
        this.legacyMountedTabs.delete(tabId);
        trace.step('completed', {
          tabId,
          action: 'closed',
          noReceiver: true,
        });
        return {
          ok: true,
          tabId,
          action: 'closed',
          changed: false,
        };
      }

      if (isRestrictedAccessError(error)) {
        return await this.fail(trace, tabId, 'restricted-url');
      }
    }

    return await this.fail(trace, tabId, 'hide-failed');
  }

  private shouldFallbackToLegacyProtocol(
    reason: ActivationFailureReason
  ): boolean {
    return reason === 'readiness-timeout' || reason === 'status-check-failed';
  }

  private async tryLegacyProtocolFallback(
    tabId: number,
    intent: ActivationIntent,
    reason: ActivationFailureReason,
    trace: ActivationTrace
  ): Promise<ActivationResult | null> {
    if (!this.shouldFallbackToLegacyProtocol(reason)) {
      return null;
    }

    const assumeMounted = this.legacyMountedTabs.has(tabId);
    trace.step('status-check', {
      tabId,
      phase: 'legacy-fallback',
      reason,
      assumeMounted,
    });

    if (intent === 'toggle') {
      if (assumeMounted) {
        return await this.hideToolbar(tabId, trace, {
          allowLegacyUndefinedAck: true,
        });
      }
      return await this.showToolbar(tabId, trace, {
        allowLegacyUndefinedAck: true,
      });
    }

    return await this.showToolbar(tabId, trace, {
      allowLegacyUndefinedAck: true,
    });
  }

  private async ensureContentReady(
    tabId: number,
    trace: ActivationTrace
  ): Promise<EnsureReadyResult> {
    trace.step('status-check', {
      tabId,
      phase: 'initial',
    });

    const initialStatus = await this.tryGetToolbarStatus(tabId);
    if (initialStatus.ok) {
      return {
        ok: true,
        mounted: initialStatus.mounted,
      };
    }

    if (initialStatus.reason === 'restricted') {
      return {ok: false, reason: 'restricted-url'};
    }

    trace.step('inject-attempt', {
      tabId,
      reason: initialStatus.reason,
    });

    try {
      await this.deps.executeScript(tabId, this.deps.getContentScriptFiles());
    } catch (error) {
      if (isRestrictedAccessError(error)) {
        return {ok: false, reason: 'restricted-url'};
      }
      trace.step('inject-attempt', {
        tabId,
        error: String(error),
      });
      return {ok: false, reason: 'injection-failed'};
    }

    const ready = await this.waitForReadiness(tabId, trace);
    if (!ready.ok) {
      return ready;
    }

    trace.step('status-check', {
      tabId,
      phase: 'post-readiness',
    });

    const postStatus = await this.tryGetToolbarStatus(tabId);
    if (postStatus.ok) {
      return {
        ok: true,
        mounted: postStatus.mounted,
      };
    }

    if (postStatus.reason === 'restricted') {
      return {ok: false, reason: 'restricted-url'};
    }

    return {
      ok: false,
      reason: 'status-check-failed',
    };
  }

  private async tryGetToolbarStatus(tabId: number): Promise<StatusCheckResult> {
    try {
      const status = await this.deps.getToolbarStatus(tabId);
      return {
        ok: true,
        mounted: status.mounted,
      };
    } catch (error) {
      if (isNoReceiverError(error)) {
        return {ok: false, reason: 'no-receiver'};
      }

      if (isRestrictedAccessError(error)) {
        return {ok: false, reason: 'restricted'};
      }

      return {ok: false, reason: 'other'};
    }
  }

  private async waitForReadiness(
    tabId: number,
    trace: ActivationTrace
  ): Promise<EnsureReadyResult> {
    for (const [index, delay] of READINESS_RETRY_DELAYS_MS.entries()) {
      if (delay > 0) {
        await this.deps.sleep(delay);
      }

      try {
        const response = await this.deps.pingToolbar(tabId);
        trace.step('status-check', {
          tabId,
          phase: 'ping',
          attempt: index + 1,
          ready: response.ready,
        });

        if (response.ready) {
          return {ok: true, mounted: false};
        }
      } catch (error) {
        if (isRestrictedAccessError(error)) {
          return {ok: false, reason: 'restricted-url'};
        }

        trace.step('status-check', {
          tabId,
          phase: 'ping',
          attempt: index + 1,
          error: String(error),
        });
      }
    }

    return {
      ok: false,
      reason: 'readiness-timeout',
    };
  }

  private async fail(
    trace: ActivationTrace,
    tabId: number | undefined,
    reason: ActivationFailureReason,
    details: Record<string, unknown> = {}
  ): Promise<ActivationResult> {
    trace.step('failed', {
      tabId,
      reason,
      ...details,
    });

    await this.deps.notifyActivationFailure(tabId, reason);

    return {
      ok: false,
      tabId,
      reason,
      changed: false,
    };
  }
}
