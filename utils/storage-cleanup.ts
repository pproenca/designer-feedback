// =============================================================================
// Storage Cleanup Utilities
// Handles cleanup of expired annotations and storage quota monitoring
// =============================================================================

import type { Annotation } from '@/types';
import { ANNOTATIONS_PREFIX } from '@/utils/storage-constants';
import { lastCleanupTimestamp } from '@/utils/storage-items';
import { storage } from 'wxt/utils/storage';

const DEFAULT_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Storage quota constants (local storage area has 10MB limit)
const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB
const STORAGE_WARNING_THRESHOLD = 0.8; // Warn at 80% capacity

/**
 * Strip URL field from annotation before storage
 */
function stripUrl(annotation: Annotation & { url?: string }): Annotation {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { url, ...rest } = annotation;
  return rest as Annotation;
}

/**
 * Normalize stored annotations, fixing duplicates and invalid data
 */
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
 * Clean up expired annotations from storage
 */
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

/**
 * Check if cleanup should run and execute if needed
 * Returns true if cleanup was executed
 */
export async function maybeRunCleanup(): Promise<boolean> {
  const now = Date.now();
  const lastCleanup = await lastCleanupTimestamp.getValue();

  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    await lastCleanupTimestamp.setValue(now);
    const cutoff = now - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    // Fire-and-forget: don't block annotation loading
    cleanupExpiredAnnotations(cutoff).catch((error) => {
      console.warn('Failed to clean expired annotations:', error);
    });
    return true;
  }
  return false;
}

/**
 * Get retention cutoff timestamp
 */
export function getRetentionCutoff(): number {
  return Date.now() - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}
