// =============================================================================
// Extension Storage Utilities (WXT storage local area)
// =============================================================================

import type { Annotation } from '@/types';
import { getAnnotationsBucketKey } from '@/utils/storage-constants';
import { storage } from 'wxt/utils/storage';
import { backgroundMessenger } from '@/utils/messaging';
import {
  maybeRunCleanup,
  getRetentionCutoff,
} from '@/utils/storage-cleanup';
import {
  getStorageKeysForCurrentUrl,
  isKnownStorageKey,
  normalizeCoordinates,
} from '@/utils/storage-migration';

// Re-export for API compatibility
export { checkStorageQuota } from '@/utils/storage-cleanup';
export { getStorageKey } from '@/utils/storage-migration';

function stripUrl(annotation: Annotation & { url?: string }): Annotation {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { url, ...rest } = annotation;
  return rest as Annotation;
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
  const cutoff = getRetentionCutoff();

  // Trigger cleanup if needed (fire-and-forget)
  maybeRunCleanup().catch((error) => {
    console.warn('Failed to run cleanup:', error);
  });

  const keys = getStorageKeysForCurrentUrl();
  const results = await Promise.all(keys.map((key) => loadAnnotationsForKey(key)));
  const merged = new Map<string, Annotation>();

  results.flat().forEach((annotation) => {
    if (annotation.timestamp <= cutoff) return;
    const normalized = normalizeCoordinates(annotation);
    merged.set(annotation.id, normalized);
  });

  const mergedAnnotations = Array.from(merged.values());

  // Consolidate legacy keys to primary key
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
  const keys = getStorageKeysForCurrentUrl();
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
  const keys = getStorageKeysForCurrentUrl();
  await Promise.all(keys.map((key) => clearAnnotationsForKey(key)));
}

/**
 * Get annotation count for a specific URL
 */
export async function getAnnotationCount(url: string): Promise<number> {
  const cutoff = getRetentionCutoff();
  const keys = isKnownStorageKey(url) ? getStorageKeysForCurrentUrl() : [url];
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
  backgroundMessenger.sendMessage('updateBadge', count);
}
