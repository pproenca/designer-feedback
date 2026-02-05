import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  clearResumeExportQueue,
  enqueueResumeExportRequest,
  subscribeResumeExportRequests,
} from './resume-export-queue';

describe('resume-export queue', () => {
  afterEach(() => {
    clearResumeExportQueue();
  });

  it('delivers a request queued before subscription (race protection)', () => {
    enqueueResumeExportRequest({requestId: 'req-1', format: 'snapshot'});
    const listener = vi.fn();

    const unsubscribe = subscribeResumeExportRequests(listener);

    expect(listener).toHaveBeenCalledWith({
      requestId: 'req-1',
      format: 'snapshot',
    });
    unsubscribe();
  });

  it('deduplicates queued requests by requestId', () => {
    enqueueResumeExportRequest({requestId: 'same', format: 'snapshot'});
    enqueueResumeExportRequest({requestId: 'same', format: 'snapshot'});
    const listener = vi.fn();

    const unsubscribe = subscribeResumeExportRequests(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('streams requests immediately when listeners are already attached', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeResumeExportRequests(listener);

    enqueueResumeExportRequest({requestId: 'req-live', format: 'snapshot'});

    expect(listener).toHaveBeenCalledWith({
      requestId: 'req-live',
      format: 'snapshot',
    });
    unsubscribe();
  });
});
