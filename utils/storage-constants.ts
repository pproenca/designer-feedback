// =============================================================================
// Storage Constants and Key Helpers
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
