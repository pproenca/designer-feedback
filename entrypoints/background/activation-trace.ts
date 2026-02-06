import type {
  ActivationIntent,
  ActivationSource,
  ActivationStep,
} from './activation-types';

const TRACE_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DF_DEBUG_ACTIVATION === '1';

export interface ActivationTrace {
  readonly attemptId: string;
  step(
    event: ActivationStep,
    details?: Record<string, unknown> | undefined
  ): void;
}

function createAttemptId(source: ActivationSource): string {
  return `${source}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function createActivationTrace(
  source: ActivationSource,
  intent: ActivationIntent,
  tabId: number | undefined
): ActivationTrace {
  const attemptId = createAttemptId(source);

  const step: ActivationTrace['step'] = (event, details = {}) => {
    if (!TRACE_ENABLED) {
      return;
    }

    console.log('[ActivationTrace]', {
      attemptId,
      source,
      intent,
      tabId,
      event,
      ...details,
    });
  };

  return {
    attemptId,
    step,
  };
}
