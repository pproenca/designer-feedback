import {describe, expect, it} from 'vitest';
import type {PendingCaptureRequest} from '@/types';
import {
  PENDING_CAPTURE_TTL_MS,
  clearPendingCaptureForTab,
  createPendingCaptureRequest,
  didResumeExportAcknowledgeRequest,
  getPendingCaptureForTab,
  setPendingCaptureForTab,
  trimExpiredPendingCaptures,
} from './pending-capture';

describe('pending-capture helpers', () => {
  it('creates pending capture requests with active-tab-retry source by default', () => {
    const request = createPendingCaptureRequest('snapshot');
    expect(request.format).toBe('snapshot');
    expect(request.source).toBe('active-tab-retry');
    expect(request.createdAt).toBeGreaterThan(0);
    expect(request.requestId.length).toBeGreaterThan(0);
  });

  it('preserves explicit source for context-menu requests', () => {
    const request = createPendingCaptureRequest(
      'snapshot',
      'context-menu',
      1700000000000
    );
    expect(request.format).toBe('snapshot');
    expect(request.source).toBe('context-menu');
    expect(request.requestId.length).toBeGreaterThan(0);
  });

  it('stores and reads requests using strict tab-id key mapping', () => {
    const request: PendingCaptureRequest = {
      requestId: 'req-1',
      format: 'snapshot',
      createdAt: 1700000000000,
    };
    const store = setPendingCaptureForTab({}, 42, request);
    expect(store).toEqual({'42': request});
    expect(getPendingCaptureForTab(store, 42)).toEqual(request);
    expect(getPendingCaptureForTab(store, 99)).toBeNull();
  });

  it('clears requests for a single tab only', () => {
    const store = {
      '1': {requestId: 'req-1', format: 'snapshot', createdAt: 1},
      '2': {requestId: 'req-2', format: 'snapshot', createdAt: 2},
    } satisfies Record<string, PendingCaptureRequest>;
    const next = clearPendingCaptureForTab(store, 1);
    expect(next).toEqual({
      '2': {requestId: 'req-2', format: 'snapshot', createdAt: 2},
    });
  });

  it('trims expired requests with the configured TTL', () => {
    const now = 200000;
    const withinTtl = now - PENDING_CAPTURE_TTL_MS + 1000;
    const expired = now - PENDING_CAPTURE_TTL_MS - 1000;
    const store = {
      '1': {requestId: 'keep', format: 'snapshot', createdAt: withinTtl},
      '2': {requestId: 'drop', format: 'snapshot', createdAt: expired},
    } satisfies Record<string, PendingCaptureRequest>;

    const trimmed = trimExpiredPendingCaptures(store, now);
    expect(trimmed).toEqual({
      '1': {requestId: 'keep', format: 'snapshot', createdAt: withinTtl},
    });
  });

  it('clears pending request only when ack is accepted and request id matches', () => {
    const pending: PendingCaptureRequest = {
      requestId: 'match-id',
      format: 'snapshot',
      createdAt: 1700000000000,
    };
    expect(didResumeExportAcknowledgeRequest(pending, null)).toBe(false);
    expect(
      didResumeExportAcknowledgeRequest(pending, {
        accepted: false,
        requestId: 'match-id',
      })
    ).toBe(false);
    expect(
      didResumeExportAcknowledgeRequest(pending, {
        accepted: true,
        requestId: 'other-id',
      })
    ).toBe(false);
    expect(
      didResumeExportAcknowledgeRequest(pending, {
        accepted: true,
        requestId: 'match-id',
      })
    ).toBe(true);
  });
});
