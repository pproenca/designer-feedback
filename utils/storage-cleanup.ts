import type {Annotation} from '@/types';
import {ANNOTATIONS_PREFIX} from '@/utils/storage-constants';
import {getExtensionApi} from '@/utils/extension-api';

const DEFAULT_RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const LAST_CLEANUP_TIMESTAMP_KEY = 'designer-feedback:last-cleanup';

const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024;
const STORAGE_WARNING_THRESHOLD = 0.8;

function normalizeStoredAnnotations(value: unknown): Annotation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(Boolean)
    .map((raw, index) => {
      if (!raw || typeof raw !== 'object') return null;
      const annotation = raw as Annotation;
      let id = typeof annotation.id === 'string' ? annotation.id.trim() : '';
      if (!id || seen.has(id)) {
        id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${index}`;
      }
      seen.add(id);
      return {...annotation, id};
    })
    .filter(Boolean) as Annotation[];
}

async function setLocal(values: Record<string, unknown>): Promise<void> {
  if (!Object.keys(values).length) return;
  try {
    const extensionApi = getExtensionApi();
    await extensionApi.storage.local.set(values);
  } catch (error) {
    console.warn('Storage access failed (set):', error);
  }
}

async function removeLocal(keys: string | string[]): Promise<void> {
  const normalizedKeys = Array.isArray(keys) ? keys : [keys];
  if (!normalizedKeys.length) return;
  try {
    const extensionApi = getExtensionApi();
    await extensionApi.storage.local.remove(normalizedKeys);
  } catch (error) {
    console.warn('Storage access failed (remove):', error);
  }
}

async function getAllLocal(): Promise<Record<string, unknown>> {
  try {
    const extensionApi = getExtensionApi();
    return await extensionApi.storage.local.get(null);
  } catch (error) {
    console.warn('Storage access failed (get all):', error);
    return {};
  }
}

async function getBytesInUse(): Promise<number> {
  try {
    const extensionApi = getExtensionApi();
    const snapshot = await extensionApi.storage.local.get(null);
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
  try {
    const extensionApi = getExtensionApi();
    const result = await extensionApi.storage.local.get(
      LAST_CLEANUP_TIMESTAMP_KEY
    );
    const value = result[LAST_CLEANUP_TIMESTAMP_KEY];
    return typeof value === 'number' ? value : 0;
  } catch (error) {
    console.warn('Failed to read last cleanup timestamp:', error);
    return 0;
  }
}

async function setLastCleanupTimestamp(value: number): Promise<void> {
  try {
    const extensionApi = getExtensionApi();
    await extensionApi.storage.local.set({[LAST_CLEANUP_TIMESTAMP_KEY]: value});
  } catch (error) {
    console.warn('Failed to store last cleanup timestamp:', error);
  }
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
  const all = await getAllLocal();
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
    await setLocal(updates);
  }
  if (removals.length > 0) {
    await removeLocal(removals);
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
