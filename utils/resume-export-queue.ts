import type {ResumeExportRequest} from '@/utils/messaging';

type ResumeExportListener = (request: ResumeExportRequest) => void;

const pendingRequestsById = new Map<string, ResumeExportRequest>();
const listeners = new Set<ResumeExportListener>();

function flushPendingRequests(): void {
  if (listeners.size === 0 || pendingRequestsById.size === 0) {
    return;
  }
  const pending = Array.from(pendingRequestsById.values());
  pendingRequestsById.clear();
  for (const request of pending) {
    for (const listener of listeners) {
      listener(request);
    }
  }
}

export function enqueueResumeExportRequest(request: ResumeExportRequest): void {
  pendingRequestsById.set(request.requestId, request);
  flushPendingRequests();
}

export function subscribeResumeExportRequests(
  listener: ResumeExportListener
): () => void {
  listeners.add(listener);
  flushPendingRequests();
  return () => {
    listeners.delete(listener);
  };
}

export function clearResumeExportQueue(): void {
  pendingRequestsById.clear();
}
