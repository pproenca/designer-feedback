export const RESTRICTED_ACCESS_ERROR_PATTERNS: readonly string[] = [
  'cannot access contents of the page',
  'missing host permission',
  'activetab',
  'not allowed to access',
  'permission is required',
  'cannot access a chrome://',
  'extensions gallery cannot be scripted',
];

export function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isRestrictedAccessError(error: unknown): boolean {
  const message = normalizeErrorMessage(error).toLowerCase();
  return RESTRICTED_ACCESS_ERROR_PATTERNS.some(pattern =>
    message.includes(pattern)
  );
}
