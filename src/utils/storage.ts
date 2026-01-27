// =============================================================================
// IndexedDB Storage Utilities
// =============================================================================

import type { Annotation } from '@/types';

const DB_NAME = 'designer-feedback-db';
const DB_VERSION = 1;
const ANNOTATIONS_STORE = 'annotations';
const DEFAULT_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

let dbInstance: IDBDatabase | null = null;
let lastCleanupAt = 0;
let legacyMigrationAttempted = false;

/**
 * Initialize IndexedDB connection
 */
export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create annotations store with URL as index
      if (!db.objectStoreNames.contains(ANNOTATIONS_STORE)) {
        const store = db.createObjectStore(ANNOTATIONS_STORE, { keyPath: 'id' });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Get the storage key for a URL
 */
export function getStorageKey(): string {
  const origin = window.location.origin === 'null' ? '' : window.location.origin;
  return `${origin}${window.location.pathname}${window.location.search}`;
}

function getLegacyStorageKey(): string {
  return window.location.pathname + window.location.search;
}

function getStorageKeys(): string[] {
  const currentKey = getStorageKey();
  const legacyKey = getLegacyStorageKey();
  return currentKey === legacyKey ? [currentKey] : [currentKey, legacyKey];
}

async function cleanupExpiredAnnotations(db: IDBDatabase, cutoff: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanupTx = db.transaction(ANNOTATIONS_STORE, 'readwrite');
    const store = cleanupTx.objectStore(ANNOTATIONS_STORE);
    const index = store.index('timestamp');
    const range = IDBKeyRange.upperBound(cutoff);
    const request = index.openCursor(range);

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    cleanupTx.oncomplete = () => resolve();
    cleanupTx.onerror = () => reject(new Error('Failed to clean expired annotations'));
  });
}

async function loadAnnotationsForKey(db: IDBDatabase, url: string): Promise<Annotation[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ANNOTATIONS_STORE, 'readonly');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const index = store.index('url');
    const request = index.getAll(url);

    request.onsuccess = () => resolve(request.result as (Annotation & { url: string })[]);
    request.onerror = () => reject(new Error('Failed to load annotations'));
  });
}

async function clearAnnotationsForKey(db: IDBDatabase, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ANNOTATIONS_STORE, 'readwrite');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const index = store.index('url');
    const request = index.openCursor(url);

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(new Error('Failed to clear annotations'));
  });
}

async function migrateLegacyAnnotations(db: IDBDatabase, legacyKey: string, currentKey: string): Promise<void> {
  const legacyAnnotations = await loadAnnotationsForKey(db, legacyKey);
  if (legacyAnnotations.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(ANNOTATIONS_STORE, 'readwrite');
    const store = tx.objectStore(ANNOTATIONS_STORE);
    legacyAnnotations.forEach((annotation) => {
      store.put({ ...annotation, url: currentKey });
    });
    const index = store.index('url');
    const request = index.openCursor(legacyKey);

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Failed to migrate legacy annotations'));
  });
}

/**
 * Save an annotation to IndexedDB
 */
export async function saveAnnotation(annotation: Annotation & { url: string }): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ANNOTATIONS_STORE, 'readwrite');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const request = store.put(annotation);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to save annotation'));
  });
}

/**
 * Load all annotations for the current URL
 */
export async function loadAnnotations(): Promise<Annotation[]> {
  const db = await initDB();
  const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const now = Date.now();
  if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
    await cleanupExpiredAnnotations(db, cutoff);
    lastCleanupAt = now;
  }

  const currentKey = getStorageKey();
  const legacyKey = getLegacyStorageKey();

  if (!legacyMigrationAttempted && currentKey !== legacyKey) {
    legacyMigrationAttempted = true;
    try {
      await migrateLegacyAnnotations(db, legacyKey, currentKey);
    } catch (error) {
      console.warn('Failed to migrate legacy annotations:', error);
    }
  }

  const keys = currentKey === legacyKey ? [currentKey] : [currentKey, legacyKey];
  const results = await Promise.all(keys.map((key) => loadAnnotationsForKey(db, key)));
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

  return Array.from(merged.values());
}

/**
 * Delete a single annotation
 */
export async function deleteAnnotation(id: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ANNOTATIONS_STORE, 'readwrite');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete annotation'));
  });
}

/**
 * Clear all annotations for the current URL
 */
export async function clearAnnotations(): Promise<void> {
  const db = await initDB();
  const keys = getStorageKeys();
  await Promise.all(keys.map((key) => clearAnnotationsForKey(db, key)));
}

/**
 * Get annotation count for a specific URL
 */
export async function getAnnotationCount(url: string): Promise<number> {
  const db = await initDB();
  const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const keys = url === getStorageKey() ? getStorageKeys() : [url];
  const results = await Promise.all(keys.map((key) => loadAnnotationsForKey(db, key)));
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
  chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count });
}
