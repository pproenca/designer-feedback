import type {Annotation} from '@/types';
import {ANNOTATIONS_PREFIX} from '@/utils/storage-constants';
import {
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  getAllLocalStorage,
} from '@/utils/extension-api';
import {normalizeStoredAnnotations} from '@/utils/normalize-annotations';

const DEFAULT_RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const LAST_CLEANUP_TIMESTAMP_KEY = 'designer-feedback:last-cleanup';

const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024;
const STORAGE_WARNING_THRESHOLD = 0.8;

async function getBytesInUse(): Promise<number> {
  try {
    const snapshot = await getAllLocalStorage();
    const serialized = JSON.stringify(snapshot);
    if (typeof Blob !== 'undefined') {
      return new Blob([serialized]).size;
    }
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(serialized).length;
    }
    return serialized.length;
  } catch (error) {
    console.warn('Failed to get storage usage:', error);
    return 0;
  }
}

async function getLastCleanupTimestamp(): Promise<number> {
  return getLocalStorage(LAST_CLEANUP_TIMESTAMP_KEY, 0);
}

async function setLastCleanupTimestamp(value: number): Promise<void> {
  await setLocalStorage({[LAST_CLEANUP_TIMESTAMP_KEY]: value});
}

export async function checkStorageQuota(): Promise<{
  ok: boolean;
  bytesUsed: number;
  bytesTotal: number;
  percentUsed: number;
}> {
  const bytesUsed = await getBytesInUse();
  const percentUsed = bytesUsed / STORAGE_QUOTA_BYTES;

  if (percentUsed >= STORAGE_WARNING_THRESHOLD && percentUsed < 1) {
    console.warn(
      `Storage quota warning: ${Math.round(percentUsed * 100)}% used ` +
        `(${Math.round(bytesUsed / 1024)}KB of ${Math.round(STORAGE_QUOTA_BYTES / 1024)}KB)`
    );
  }

  const ok = percentUsed < 1;

  if (!ok) {
    console.warn(
      `Storage quota exceeded: ${Math.round(percentUsed * 100)}% used ` +
        `(${Math.round(bytesUsed / 1024)}KB of ${Math.round(STORAGE_QUOTA_BYTES / 1024)}KB)`
    );
  }

  return {
    ok,
    bytesUsed,
    bytesTotal: STORAGE_QUOTA_BYTES,
    percentUsed,
  };
}

export async function cleanupExpiredAnnotations(cutoff: number): Promise<void> {
  const all = await getAllLocalStorage();
  const updates: Record<string, Annotation[]> = {};
  const removals: string[] = [];

  Object.entries(all).forEach(([key, value]) => {
    if (!key.startsWith(ANNOTATIONS_PREFIX)) return;
    const items = normalizeStoredAnnotations(value);
    if (items.length === 0) {
      removals.push(key);
      return;
    }
    const filtered = items.filter(
      annotation =>
        typeof annotation.timestamp === 'number' &&
        annotation.timestamp > cutoff
    );
    if (filtered.length === 0) {
      removals.push(key);
      return;
    }
    if (filtered.length !== items.length) {
      updates[key] = filtered;
    }
  });

  if (Object.keys(updates).length > 0) {
    await setLocalStorage(updates);
  }
  if (removals.length > 0) {
    await removeLocalStorage(removals);
  }
}

export async function maybeRunCleanup(): Promise<boolean> {
  const now = Date.now();
  const lastCleanup = await getLastCleanupTimestamp();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    await setLastCleanupTimestamp(now);
    const cutoff = now - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    cleanupExpiredAnnotations(cutoff).catch(error => {
      console.warn('Failed to clean expired annotations:', error);
    });
    return true;
  }
  return false;
}

export function getRetentionCutoff(): number {
  return Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}
