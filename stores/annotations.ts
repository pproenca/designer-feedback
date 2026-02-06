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
import {debounce} from 'lodash-es';

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

const debouncedUpdateBadge = debounce((count: number) => {
  updateBadgeCount(count);
}, BADGE_DEBOUNCE_MS);

export function initBadgeSync() {
  return useAnnotationsStore.subscribe((state, prevState) => {
    if (state.annotations.length !== prevState.annotations.length) {
      debouncedUpdateBadge(state.annotations.length);
    }
  });
}
