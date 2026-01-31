

import type { Annotation } from '@/types';
import { getAnnotationsBucketKey, STORAGE_KEY_VERSION } from '@/utils/storage-constants';
import { hashString } from '@/utils/hash';
import { storage } from 'wxt/utils/storage';
import { backgroundMessenger } from '@/utils/messaging';
import { maybeRunCleanup, getRetentionCutoff } from '@/utils/storage-cleanup';

export function getStorageKey(): string {
  const origin = window.location.origin === 'null' ? '' : window.location.origin;
  const raw = `${origin}${window.location.pathname}${window.location.search}`;
  return `${STORAGE_KEY_VERSION}:${hashString(raw)}`;
}

function stripUrl(annotation: Annotation & { url?: string }): Annotation {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure to omit
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

export async function saveAnnotation(annotation: Annotation & { url: string }): Promise<void> {
  const urlKey = annotation.url;
  const existing = await loadAnnotationsForKey(urlKey);
  const next = existing.filter((item) => item.id !== annotation.id);
  next.push(stripUrl(annotation));
  await saveAnnotationsForKey(urlKey, next);
}

export async function loadAnnotations(): Promise<Annotation[]> {
  const cutoff = getRetentionCutoff();


  maybeRunCleanup().catch((error) => {
    console.warn('Failed to run cleanup:', error);
  });

  const key = getStorageKey();
  const annotations = await loadAnnotationsForKey(key);

  return annotations.filter((annotation) => annotation.timestamp > cutoff);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const key = getStorageKey();
  const annotations = await loadAnnotationsForKey(key);
  const filtered = annotations.filter((annotation) => annotation.id !== id);

  if (filtered.length !== annotations.length) {
    await saveAnnotationsForKey(key, filtered);
  }
}

export async function clearAnnotations(): Promise<void> {
  const key = getStorageKey();
  await clearAnnotationsForKey(key);
}

export async function getAnnotationCount(url: string): Promise<number> {
  const cutoff = getRetentionCutoff();
  const annotations = await loadAnnotationsForKey(url);

  return annotations.filter((annotation) => annotation.timestamp > cutoff).length;
}

export function updateBadgeCount(count: number): void {
  backgroundMessenger.sendMessage('updateBadge', count);
}
