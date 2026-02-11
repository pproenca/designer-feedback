import {create} from 'zustand';
import type {Annotation} from '@/types';
import {
  loadAnnotations as loadFromStorage,
  saveAnnotation,
  deleteAnnotation,
  clearAnnotations,
  getStorageKey,
  updateBadgeCount,
} from '@/utils/storage';

export interface AnnotationsState {
  annotations: Annotation[];
  isLoading: boolean;
}

export interface AnnotationsActions {
  loadAnnotations: () => Promise<void>;

  annotationCreated: (annotation: Annotation) => Promise<void>;

  annotationUpdated: (
    id: string,
    updates: Partial<Annotation>
  ) => Promise<void>;

  annotationDeleted: (id: string) => Promise<void>;

  annotationsCleared: () => Promise<void>;
}

const BADGE_DEBOUNCE_MS = 150;

function createDebouncedTask<TArgs extends unknown[]>(
  task: (...args: TArgs) => void,
  delayMs: number
): (...args: TArgs) => void {
  let timeoutId: number | null = null;

  return (...args: TArgs) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      timeoutId = null;
      task(...args);
    }, delayMs);
  };
}

export const useAnnotationsStore = create<
  AnnotationsState & AnnotationsActions
>(set => ({
  annotations: [],
  isLoading: false,

  loadAnnotations: async () => {
    set({isLoading: true});
    try {
      const annotations = await loadFromStorage();
      set({annotations, isLoading: false});
    } catch (error) {
      console.error('Failed to load annotations:', error);
      set({isLoading: false});
    }
  },

  annotationCreated: async (annotation: Annotation) => {
    try {
      await saveAnnotation({...annotation, url: getStorageKey()});
      set(state => ({
        annotations: [...state.annotations, annotation],
      }));
    } catch (error) {
      console.error('Failed to save annotation:', error);
    }
  },

  annotationUpdated: async (id: string, updates: Partial<Annotation>) => {
    const annotation = useAnnotationsStore
      .getState()
      .annotations.find(a => a.id === id);
    if (!annotation) return;

    const updated = {...annotation, ...updates};
    try {
      await saveAnnotation({...updated, url: getStorageKey()});
      set(state => ({
        annotations: state.annotations.map(a => (a.id === id ? updated : a)),
      }));
    } catch (error) {
      console.error('Failed to update annotation:', error);
    }
  },

  annotationDeleted: async (id: string) => {
    try {
      await deleteAnnotation(id);
      set(state => ({
        annotations: state.annotations.filter(a => a.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    }
  },

  annotationsCleared: async () => {
    try {
      await clearAnnotations();
      set({annotations: []});
    } catch (error) {
      console.error('Failed to clear annotations:', error);
    }
  },
}));

const debouncedUpdateBadge = createDebouncedTask((count: number) => {
  updateBadgeCount(count);
}, BADGE_DEBOUNCE_MS);

export function initBadgeSync(): () => void {
  return useAnnotationsStore.subscribe((state, prevState) => {
    if (state.annotations.length !== prevState.annotations.length) {
      debouncedUpdateBadge(state.annotations.length);
    }
  });
}
