import type {
  PendingCaptureFormat,
  PendingCaptureRequest,
  PendingCaptureSource,
} from '@/types';
import type {ResumeExportResponse} from '@/utils/messaging';

export const PENDING_CAPTURE_TTL_MS = 5 * 60 * 1000;

export type PendingCaptureStore = Record<string, PendingCaptureRequest>;

export function createPendingCaptureRequest(
  format: PendingCaptureFormat,
  source: PendingCaptureSource = 'active-tab-retry',
  now = Date.now()
): PendingCaptureRequest {
  return {
    requestId: `${now}-${Math.random().toString(36).slice(2, 10)}`,
    format,
    createdAt: now,
    source,
  };
}

export function trimExpiredPendingCaptures(
  current: PendingCaptureStore,
  now = Date.now(),
  ttlMs = PENDING_CAPTURE_TTL_MS
): PendingCaptureStore {
  const next: PendingCaptureStore = {};
  let changed = false;
  for (const [tabKey, request] of Object.entries(current)) {
    if (request?.createdAt && now - request.createdAt <= ttlMs) {
      next[tabKey] = request;
    } else {
      changed = true;
    }
  }
  return changed ? next : current;
}

export function setPendingCaptureForTab(
  current: PendingCaptureStore,
  tabId: number,
  request: PendingCaptureRequest
): PendingCaptureStore {
  return {...current, [String(tabId)]: request};
}

export function getPendingCaptureForTab(
  current: PendingCaptureStore,
  tabId: number
): PendingCaptureRequest | null {
  return current[String(tabId)] ?? null;
}

export function clearPendingCaptureForTab(
  current: PendingCaptureStore,
  tabId: number
): PendingCaptureStore {
  const tabKey = String(tabId);
  if (!current[tabKey]) return current;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure to omit
  const {[tabKey]: _, ...rest} = current;
  return rest;
}

export function didResumeExportAcknowledgeRequest(
  pending: PendingCaptureRequest,
  response: ResumeExportResponse | null
): boolean {
  if (!response?.accepted) {
    return false;
  }
  return response.requestId === pending.requestId;
}
