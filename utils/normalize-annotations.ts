import type {Annotation} from '@/types';

function isAnnotationRecord(
  value: unknown
): value is Record<string, unknown> & Pick<Annotation, 'timestamp'> {
  if (!value || typeof value !== 'object') return false;
  return (
    'timestamp' in value &&
    typeof (value as Record<string, unknown>).timestamp === 'number'
  );
}

export function normalizeStoredAnnotations(value: unknown): Annotation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(Boolean)
    .map((raw, index) => {
      if (!isAnnotationRecord(raw)) return null;
      const rawId = raw.id;
      let id = typeof rawId === 'string' ? rawId.trim() : '';
      if (!id || seen.has(id)) {
        id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${index}`;
      }
      seen.add(id);
      // Storage boundary: raw is validated to have `timestamp` and assigned a valid `id`
      return {...raw, id} as Annotation;
    })
    .filter((item): item is Annotation => item !== null);
}
