import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import type { Annotation } from '@/types';

// Mock storage utilities before importing the store
vi.mock('@/utils/storage', () => ({
  loadAnnotations: vi.fn(),
  saveAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  clearAnnotations: vi.fn(),
  getStorageKey: vi.fn(() => 'test-url-key'),
  updateBadgeCount: vi.fn(),
}));

// Import after mocking
import { useAnnotationsStore } from './annotations';
import * as storage from '@/utils/storage';

const mockAnnotation: Annotation = {
  id: 'test-1',
  x: 100,
  y: 200,
  comment: 'Test comment',
  category: 'bug',
  element: 'div',
  elementPath: 'body > div',
  timestamp: Date.now(),
  isFixed: false,
};

const mockAnnotation2: Annotation = {
  id: 'test-2',
  x: 300,
  y: 400,
  comment: 'Another comment',
  category: 'suggestion',
  element: 'button',
  elementPath: 'body > button',
  timestamp: Date.now(),
  isFixed: false,
};

describe('useAnnotationsStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAnnotationsStore.setState({
      annotations: [],
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty annotations array', () => {
      const state = useAnnotationsStore.getState();
      expect(state.annotations).toEqual([]);
    });

    it('should have isLoading set to false', () => {
      const state = useAnnotationsStore.getState();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('loadAnnotations', () => {
    it('should set isLoading to true while loading', async () => {
      vi.mocked(storage.loadAnnotations).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([mockAnnotation]), 50))
      );

      const loadPromise = useAnnotationsStore.getState().loadAnnotations();

      // Check loading state immediately
      expect(useAnnotationsStore.getState().isLoading).toBe(true);

      await loadPromise;
    });

    it('should load annotations from storage and update state', async () => {
      vi.mocked(storage.loadAnnotations).mockResolvedValue([mockAnnotation, mockAnnotation2]);

      await act(async () => {
        await useAnnotationsStore.getState().loadAnnotations();
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(2);
      expect(state.annotations[0].id).toBe('test-1');
      expect(state.annotations[1].id).toBe('test-2');
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading to false after loading completes', async () => {
      vi.mocked(storage.loadAnnotations).mockResolvedValue([]);

      await act(async () => {
        await useAnnotationsStore.getState().loadAnnotations();
      });

      expect(useAnnotationsStore.getState().isLoading).toBe(false);
    });

    it('should handle load errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(storage.loadAnnotations).mockRejectedValue(new Error('Load failed'));

      await act(async () => {
        await useAnnotationsStore.getState().loadAnnotations();
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('annotationCreated', () => {
    it('should add annotation to state', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation);
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(1);
      expect(state.annotations[0]).toEqual(mockAnnotation);
    });

    it('should persist annotation to storage', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation);
      });

      expect(storage.saveAnnotation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockAnnotation.id,
          url: 'test-url-key',
        })
      );
    });

    it('should not add annotation if storage fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(storage.saveAnnotation).mockRejectedValue(new Error('Save failed'));

      await act(async () => {
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation);
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it('should add multiple annotations', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation);
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation2);
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(2);
    });
  });

  describe('annotationDeleted', () => {
    beforeEach(async () => {
      // Set up initial state with annotations
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);
      await act(async () => {
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation);
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation2);
      });
    });

    it('should remove annotation from state', async () => {
      vi.mocked(storage.deleteAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationDeleted('test-1');
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(1);
      expect(state.annotations[0].id).toBe('test-2');
    });

    it('should call storage deleteAnnotation', async () => {
      vi.mocked(storage.deleteAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationDeleted('test-1');
      });

      expect(storage.deleteAnnotation).toHaveBeenCalledWith('test-1');
    });

    it('should not remove annotation if storage fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(storage.deleteAnnotation).mockRejectedValue(new Error('Delete failed'));

      await act(async () => {
        await useAnnotationsStore.getState().annotationDeleted('test-1');
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(2);

      consoleSpy.mockRestore();
    });

    it('should handle deleting non-existent annotation gracefully', async () => {
      vi.mocked(storage.deleteAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationDeleted('non-existent');
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(2);
    });
  });

  describe('annotationsCleared', () => {
    beforeEach(async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);
      await act(async () => {
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation);
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation2);
      });
    });

    it('should clear all annotations from state', async () => {
      vi.mocked(storage.clearAnnotations).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationsCleared();
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(0);
    });

    it('should call storage clearAnnotations', async () => {
      vi.mocked(storage.clearAnnotations).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationsCleared();
      });

      expect(storage.clearAnnotations).toHaveBeenCalled();
    });

    it('should not clear annotations if storage fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(storage.clearAnnotations).mockRejectedValue(new Error('Clear failed'));

      await act(async () => {
        await useAnnotationsStore.getState().annotationsCleared();
      });

      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(2);

      consoleSpy.mockRestore();
    });
  });

  describe('annotationUpdated', () => {
    beforeEach(async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);
      await act(async () => {
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation);
        await useAnnotationsStore.getState().annotationCreated(mockAnnotation2);
      });
      vi.clearAllMocks();
    });

    it('should update annotation position in state', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationUpdated('test-1', { x: 500, y: 600 });
      });

      const state = useAnnotationsStore.getState();
      const updated = state.annotations.find((a) => a.id === 'test-1');
      expect(updated?.x).toBe(500);
      expect(updated?.y).toBe(600);
      // Other properties unchanged
      expect(updated?.comment).toBe('Test comment');
    });

    it('should persist updated annotation to storage', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationUpdated('test-1', { x: 500, y: 600 });
      });

      expect(storage.saveAnnotation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-1',
          x: 500,
          y: 600,
          url: 'test-url-key',
        })
      );
    });

    it('should only update specified fields', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationUpdated('test-1', { x: 500 });
      });

      const state = useAnnotationsStore.getState();
      const updated = state.annotations.find((a) => a.id === 'test-1');
      expect(updated?.x).toBe(500);
      expect(updated?.y).toBe(200); // Original value unchanged
    });

    it('should not update state if annotation not found', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationUpdated('non-existent', { x: 500 });
      });

      expect(storage.saveAnnotation).not.toHaveBeenCalled();
      const state = useAnnotationsStore.getState();
      expect(state.annotations).toHaveLength(2);
    });

    it('should not update state if storage fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(storage.saveAnnotation).mockRejectedValue(new Error('Save failed'));

      await act(async () => {
        await useAnnotationsStore.getState().annotationUpdated('test-1', { x: 500 });
      });

      const state = useAnnotationsStore.getState();
      const annotation = state.annotations.find((a) => a.id === 'test-1');
      expect(annotation?.x).toBe(100); // Original value unchanged

      consoleSpy.mockRestore();
    });

    it('should not affect other annotations', async () => {
      vi.mocked(storage.saveAnnotation).mockResolvedValue(undefined);

      await act(async () => {
        await useAnnotationsStore.getState().annotationUpdated('test-1', { x: 500, y: 600 });
      });

      const state = useAnnotationsStore.getState();
      const other = state.annotations.find((a) => a.id === 'test-2');
      expect(other?.x).toBe(300);
      expect(other?.y).toBe(400);
    });
  });
});
