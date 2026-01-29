/**
 * Typed storage items using WXT's storage.defineItem pattern
 * Provides type-safe storage access with fallback defaults
 */
import { storage } from 'wxt/utils/storage';

// =============================================================================
// Session Storage Items (cleared when browser closes)
// =============================================================================

/**
 * Tracks which tabs have activated the toolbar (by origin hash)
 * Key format: tabId -> originHash
 */
export const activatedTabs = storage.defineItem<Record<string, string>>(
  'session:activated-tabs',
  {
    fallback: {},
  }
);

// Note: User settings are stored using raw browser.storage.sync with individual keys
// (enabled, lightMode) to maintain backward compatibility with existing user data.
// See hooks/useSettings.ts and entrypoints/background.ts for the settings pattern.

// =============================================================================
// Local Storage Constants and Helpers
// =============================================================================

/** Prefix for annotation storage keys */
export const ANNOTATIONS_PREFIX = 'designer-feedback:annotations:';

/** Current storage key version */
export const STORAGE_KEY_VERSION = 'v2';

/**
 * Get the full storage key for annotations at a given URL hash
 * @param hash - The hashed URL key
 * @returns Full storage key in format "v2:{hash}"
 */
export function getAnnotationsKey(hash: string): string {
  return `${STORAGE_KEY_VERSION}:${hash}`;
}

/**
 * Get the full bucket key for annotations storage
 * @param urlKey - The URL-based key
 * @returns Full bucket key with prefix
 */
export function getAnnotationsBucketKey(urlKey: string): string {
  return `${ANNOTATIONS_PREFIX}${urlKey}`;
}
