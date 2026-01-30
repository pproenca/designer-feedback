// =============================================================================
// Extension Storage Utilities (WXT storage local area)
// =============================================================================

import type { Annotation } from '@/types';
import { hashString } from '@/utils/hash';
import {
  ANNOTATIONS_PREFIX,
  STORAGE_KEY_VERSION,
  getAnnotationsBucketKey,
} from '@/utils/storage-constants';
import { storage } from 'wxt/utils/storage';

const DEFAULT_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Storage quota constants (local storage area has 10MB limit)
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB
const STORAGE_WARNING_THRESHOLD = 0.8; // Warn at 80% capacity

let lastCleanupAt = 0;

function stripUrl(annotation: Annotation & { url?: string }): Annotation {
  // Avoid persisting page-origin identifiers in storage payloads.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { url, ...rest } = annotation;
  return rest as Annotation;
}

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    return await storage.getItem<T>(`local:${key}`, { fallback });
  } catch (error) {
    console.warn('Storage access failed (get):', error);
    return fallback;
  }
}

async function setLocal(values: Record<string, unknown>): Promise<void> {
  const entries = Object.entries(values).map(([key, value]) => ({
    key: `local:${key}` as const,
    value,
  }));
  if (!entries.length) return;
  try {
    await storage.setItems(entries);
  } catch (error) {
    console.warn('Storage access failed (set):', error);
  }
}

async function removeLocal(keys: string | string[]): Promise<void> {
  const entries = (Array.isArray(keys) ? keys : [keys]).map((key) => ({
    key: `local:${key}` as const,
  }));
  if (!entries.length) return;
  try {
    await storage.removeItems(entries);
  } catch (error) {
    console.warn('Storage access failed (remove):', error);
  }
}

async function getAllLocal(): Promise<Record<string, unknown>> {
  try {
    return await storage.snapshot('local');
  } catch (error) {
    console.warn('Storage access failed (get all):', error);
    return {};
  }
}

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
      return { ...annotation, id };
    })
    .filter(Boolean) as Annotation[];
}

/**
 * Get current storage usage in bytes
 */
async function getBytesInUse(): Promise<number> {
  try {
    const snapshot = await storage.snapshot('local');
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

/**
 * Check storage quota and return status
 * @returns Object with ok status and bytes used
 */
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

  // Consider quota exceeded at 100% or above
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

/**
 * Get the storage key for a URL
 */
function getRawStorageKey(): string {
  const origin = window.location.origin === 'null' ? '' : window.location.origin;
  return `${origin}${window.location.pathname}${window.location.search}`;
}

function getHashedStorageKey(): string {
  const rawKey = getRawStorageKey();
  return `${STORAGE_KEY_VERSION}:${hashString(rawKey)}`;
}

export function getStorageKey(): string {
  return getHashedStorageKey();
}

function getLegacyStorageKey(): string {
  return window.location.pathname + window.location.search;
}

function isKnownStorageKey(urlKey: string): boolean {
  return (
    urlKey === getHashedStorageKey() ||
    urlKey === getRawStorageKey() ||
    urlKey === getLegacyStorageKey()
  );
}

function getStorageKeys(): string[] {
  const currentKey = getHashedStorageKey();
  const rawKey = getRawStorageKey();
  const legacyKey = getLegacyStorageKey();
  const keys = [currentKey, rawKey, legacyKey];
  return Array.from(new Set(keys));
}

async function cleanupExpiredAnnotations(cutoff: number): Promise<void> {
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
      (annotation) => typeof annotation.timestamp === 'number' && annotation.timestamp > cutoff
    );
    if (filtered.length === 0) {
      removals.push(key);
      return;
    }
    if (filtered.length !== items.length) {
      updates[key] = filtered.map(stripUrl);
    }
  });

  if (Object.keys(updates).length > 0) {
    await setLocal(updates);
  }
  if (removals.length > 0) {
    await removeLocal(removals);
  }
}

async function loadAnnotationsForKey(urlKey: string): Promise<Annotation[]> {
  const bucketKey = getAnnotationsBucketKey(urlKey);
  const stored = await getLocal<Annotation[]>(bucketKey, []);
  return normalizeStoredAnnotations(stored);
}

async function saveAnnotationsForKey(urlKey: string, annotations: Annotation[]): Promise<void> {
  const bucketKey = getAnnotationsBucketKey(urlKey);
  await setLocal({ [bucketKey]: annotations.map(stripUrl) });
}

async function clearAnnotationsForKey(urlKey: string): Promise<void> {
  const bucketKey = getAnnotationsBucketKey(urlKey);
  await removeLocal(bucketKey);
}

/**
 * Save an annotation to extension storage
 */
export async function saveAnnotation(annotation: Annotation & { url: string }): Promise<void> {
  const urlKey = annotation.url;
  const existing = await loadAnnotationsForKey(urlKey);
  const next = existing.filter((item) => item.id !== annotation.id);
  next.push(stripUrl(annotation));
  await saveAnnotationsForKey(urlKey, next);
}

/**
 * Load all annotations for the current URL
 */
export async function loadAnnotations(): Promise<Annotation[]> {
  const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
    lastCleanupAt = now;
    // Fire-and-forget: don't block annotation loading
    cleanupExpiredAnnotations(cutoff).catch((error) => {
      console.warn('Failed to clean expired annotations:', error);
    });
  }

  const keys = getStorageKeys();
  const results = await Promise.all(keys.map((key) => loadAnnotationsForKey(key)));
  const merged = new Map<string, Annotation>();

  results.flat().forEach((annotation) => {
    if (annotation.timestamp <= cutoff) return;
    const normalized =
      annotation.x >= 0 && annotation.x <= 1
        ? {
            ...annotation,
            x: annotation.isFixed
              ? annotation.x * window.innerWidth
              : annotation.x * window.innerWidth + window.scrollX,
          }
        : annotation;
    merged.set(annotation.id, normalized);
  });

  const mergedAnnotations = Array.from(merged.values());

  const [primaryKey, ...legacyKeys] = keys;
  const legacyHasData = results.slice(1).some((value) => Array.isArray(value) && value.length > 0);

  if (legacyHasData) {
    try {
      await saveAnnotationsForKey(primaryKey, mergedAnnotations);
      await removeLocal(legacyKeys);
    } catch (error) {
      console.warn('Failed to migrate legacy annotation keys:', error);
    }
  }

  return mergedAnnotations;
}

/**
 * Delete a single annotation
 */
export async function deleteAnnotation(id: string): Promise<void> {
  const keys = getStorageKeys();
  const results = await Promise.all(keys.map((key) => loadAnnotationsForKey(key)));
  const updates: Promise<void>[] = [];

  results.forEach((annotations, index) => {
    const filtered = annotations.filter((annotation) => annotation.id !== id);
    if (filtered.length !== annotations.length) {
      updates.push(saveAnnotationsForKey(keys[index], filtered));
    }
  });

  await Promise.all(updates);
}

/**
 * Clear all annotations for the current URL
 */
export async function clearAnnotations(): Promise<void> {
  const keys = getStorageKeys();
  await Promise.all(keys.map((key) => clearAnnotationsForKey(key)));
}

/**
 * Get annotation count for a specific URL
 */
export async function getAnnotationCount(url: string): Promise<number> {
  const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const keys = isKnownStorageKey(url) ? getStorageKeys() : [url];
  const results = await Promise.all(keys.map((key) => loadAnnotationsForKey(key)));
  const seen = new Set<string>();
  let count = 0;

  results.flat().forEach((annotation) => {
    if (annotation.timestamp <= cutoff) return;
    if (seen.has(annotation.id)) return;
    seen.add(annotation.id);
    count += 1;
  });

  return count;
}

/**
 * Update badge count via background script
 */
export function updateBadgeCount(count: number): void {
  browser.runtime.sendMessage({ type: 'UPDATE_BADGE', count });
}
