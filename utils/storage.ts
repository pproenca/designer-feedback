import type {Annotation} from '@/types';
import {
  getAnnotationsBucketKey,
  STORAGE_KEY_VERSION,
} from '@/utils/storage-constants';
import {hashString} from '@/utils/hash';
import {backgroundMessenger} from '@/utils/messaging';
import {
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
} from '@/utils/extension-api';
import {
  maybeRunCleanup,
  getRetentionCutoff,
  cleanupExpiredAnnotations,
} from '@/utils/storage-cleanup';
import {normalizeStoredAnnotations} from '@/utils/normalize-annotations';
import {getWindow} from '@/utils/dom/guards';

export function getStorageKey(targetUrl?: string): string {
  let raw = '';

  if (targetUrl) {
    try {
      const parsed = new URL(targetUrl);
      const origin = parsed.origin === 'null' ? '' : parsed.origin;
      raw = `${origin}${parsed.pathname}${parsed.search}`;
    } catch {
      raw = targetUrl;
    }
  } else {
    const win = getWindow('getStorageKey');
    const origin = win.location.origin === 'null' ? '' : win.location.origin;
    raw = `${origin}${win.location.pathname}${win.location.search}`;
  }

  return `${STORAGE_KEY_VERSION}:${hashString(raw)}`;
}

function stripUrl(annotation: Annotation & {url?: string}): Annotation {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {url, ...rest} = annotation;
  return rest;
}

function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('quota');
}

async function setLocalWithQuotaRetry(
  values: Record<string, unknown>
): Promise<void> {
  try {
    await setLocalStorage(values);
  } catch (error) {
    if (isQuotaError(error)) {
      try {
        await cleanupExpiredAnnotations(getRetentionCutoff());
        await setLocalStorage(values);
        return;
      } catch (retryError) {
        console.warn('Storage quota exceeded; retry failed:', retryError);
      }
    }
    throw error;
  }
}

async function loadAnnotationsForKey(urlKey: string): Promise<Annotation[]> {
  const bucketKey = getAnnotationsBucketKey(urlKey);
  const stored = await getLocalStorage<Annotation[]>(bucketKey, []);
  return normalizeStoredAnnotations(stored);
}

async function saveAnnotationsForKey(
  urlKey: string,
  annotations: Annotation[]
): Promise<void> {
  const bucketKey = getAnnotationsBucketKey(urlKey);
  await setLocalWithQuotaRetry({[bucketKey]: annotations.map(stripUrl)});
}

async function clearAnnotationsForKey(urlKey: string): Promise<void> {
  const bucketKey = getAnnotationsBucketKey(urlKey);
  await removeLocalStorage(bucketKey);
}

export async function saveAnnotation(
  annotation: Annotation & {url: string}
): Promise<void> {
  const urlKey = annotation.url;
  const existing = await loadAnnotationsForKey(urlKey);
  const next = existing.filter(item => item.id !== annotation.id);
  next.push(stripUrl(annotation));
  await saveAnnotationsForKey(urlKey, next);
}

export async function loadAnnotations(): Promise<Annotation[]> {
  const cutoff = getRetentionCutoff();

  maybeRunCleanup().catch(error => {
    console.warn('Failed to run cleanup:', error);
  });

  const key = getStorageKey();
  const annotations = await loadAnnotationsForKey(key);

  return annotations.filter(annotation => annotation.timestamp > cutoff);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const key = getStorageKey();
  const annotations = await loadAnnotationsForKey(key);
  const filtered = annotations.filter(annotation => annotation.id !== id);

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

  return annotations.filter(annotation => annotation.timestamp > cutoff).length;
}

export function updateBadgeCount(count: number): void {
  void backgroundMessenger.sendMessage('updateBadge', count);
}
