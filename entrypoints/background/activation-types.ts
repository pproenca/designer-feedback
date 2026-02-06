export type ActivationSource =
  | 'action'
  | 'context-menu-open-toolbar'
  | 'context-menu-export-snapshot';

export type ActivationIntent = 'toggle' | 'open' | 'open-and-export';

export type ActivationFailureReason =
  | 'missing-tab-id'
  | 'restricted-url'
  | 'injection-failed'
  | 'readiness-timeout'
  | 'show-failed'
  | 'hide-failed'
  | 'status-check-failed'
  | 'unknown';

export type ActivationStep =
  | 'invoked'
  | 'resolved-target'
  | 'status-check'
  | 'inject-attempt'
  | 'show-sent'
  | 'completed'
  | 'failed';

export type ActivationResult = {
  ok: boolean;
  tabId?: number;
  reason?: ActivationFailureReason;
  action?: 'opened' | 'closed' | 'noop';
  changed: boolean;
};

export type ActivationTarget = {
  tabId: number;
  url?: string;
};
