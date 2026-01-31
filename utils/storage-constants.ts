

export const ANNOTATIONS_PREFIX = 'designer-feedback:annotations:';

export const STORAGE_KEY_VERSION = 'v2';

export function getAnnotationsKey(hash: string): string {
  return `${STORAGE_KEY_VERSION}:${hash}`;
}

export function getAnnotationsBucketKey(urlKey: string): string {
  return `${ANNOTATIONS_PREFIX}${urlKey}`;
}
