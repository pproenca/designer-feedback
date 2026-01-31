// =============================================================================
// Storage Migration Utilities
// Handles URL key generation and legacy data migration
// =============================================================================

import type { Annotation } from '@/types';
import { hashString } from '@/utils/hash';
import { STORAGE_KEY_VERSION } from '@/utils/storage-constants';

/**
 * Get the raw URL-based storage key (no hashing)
 */
function getRawStorageKey(): string {
  const origin = window.location.origin === 'null' ? '' : window.location.origin;
  return `${origin}${window.location.pathname}${window.location.search}`;
}

/**
 * Get the hashed storage key for the current URL
 */
function getHashedStorageKey(): string {
  const rawKey = getRawStorageKey();
  return `${STORAGE_KEY_VERSION}:${hashString(rawKey)}`;
}

/**
 * Get the legacy storage key format (pathname + search only)
 */
function getLegacyStorageKey(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Get the current storage key (hashed format)
 */
export function getStorageKey(): string {
  return getHashedStorageKey();
}

/**
 * Check if a key matches any known storage key format for current URL
 */
export function isKnownStorageKey(urlKey: string): boolean {
  return (
    urlKey === getHashedStorageKey() ||
    urlKey === getRawStorageKey() ||
    urlKey === getLegacyStorageKey()
  );
}

/**
 * Get all storage keys for the current URL (current + legacy formats)
 * Used for loading and migration
 */
export function getStorageKeysForCurrentUrl(): string[] {
  const currentKey = getHashedStorageKey();
  const rawKey = getRawStorageKey();
  const legacyKey = getLegacyStorageKey();
  const keys = [currentKey, rawKey, legacyKey];
  return Array.from(new Set(keys));
}

/**
 * Normalize coordinates from legacy 0-1 range to pixel values
 * Legacy annotations stored x/y as percentages (0-1), newer ones use pixels
 */
export function normalizeCoordinates(annotation: Annotation): Annotation {
  // If x is between 0 and 1, it's a legacy percentage-based coordinate
  if (annotation.x >= 0 && annotation.x <= 1) {
    return {
      ...annotation,
      x: annotation.isFixed
        ? annotation.x * window.innerWidth
        : annotation.x * window.innerWidth + window.scrollX,
    };
  }
  return annotation;
}
