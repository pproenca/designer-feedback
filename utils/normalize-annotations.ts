import type {Annotation} from '@/types';

function isAnnotationRecord(
  value: unknown
): value is Record<string, unknown> & Pick<Annotation, 'timestamp'> {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.timestamp === 'number';
}

export function normalizeStoredAnnotations(value: unknown): Annotation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(Boolean)
    .map((raw, index) => {
      if (!isAnnotationRecord(raw)) return null;
      let id = typeof raw.id === 'string' ? (raw.id as string).trim() : '';
      if (!id || seen.has(id)) {
        id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${index}`;
      }
      seen.add(id);
      return {...raw, id} as Annotation;
    })
    .filter((item): item is Annotation => item !== null);
}
