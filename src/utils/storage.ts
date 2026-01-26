// =============================================================================
// IndexedDB Storage Utilities
// =============================================================================

import type { Annotation } from '@/types';

const DB_NAME = 'designer-feedback-db';
const DB_VERSION = 1;
const ANNOTATIONS_STORE = 'annotations';
const DEFAULT_RETENTION_DAYS = 30;

let dbInstance: IDBDatabase | null = null;

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
  return window.location.pathname + window.location.search;
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
  const url = getStorageKey();
  const cutoff = Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ANNOTATIONS_STORE, 'readonly');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const index = store.index('url');
    const request = index.getAll(url);

    request.onsuccess = () => {
      const annotations = request.result as (Annotation & { url: string })[];
      // Filter out expired annotations
      const filtered = annotations.filter((a) => a.timestamp > cutoff);
      resolve(filtered);
    };

    request.onerror = () => reject(new Error('Failed to load annotations'));
  });
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
  const url = getStorageKey();

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

/**
 * Get annotation count for a specific URL
 */
export async function getAnnotationCount(url: string): Promise<number> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ANNOTATIONS_STORE, 'readonly');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const index = store.index('url');
    const request = index.count(url);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Failed to count annotations'));
  });
}

/**
 * Update badge count via background script
 */
export function updateBadgeCount(count: number): void {
  chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', count });
}
