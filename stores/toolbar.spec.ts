import { describe, it, expect, beforeEach } from 'vitest';
import { useToolbarStore } from './toolbar';
import type { PendingAnnotation } from '@/components/FeedbackToolbar/context';

const mockPendingAnnotation: PendingAnnotation = {
  x: 100,
  y: 200,
  element: 'div',
  elementPath: 'body > div',
  target: document.createElement('div'),
  rect: new DOMRect(0, 0, 100, 50),
  isFixed: false,
  scrollX: 0,
  scrollY: 0,
};

describe('useToolbarStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    useToolbarStore.setState({
      isExpanded: true,
      addMode: 'idle',
      selectedCategory: 'suggestion',
      pendingAnnotation: null,
      selectedAnnotationId: null,
      isExportModalOpen: false,
      isEntranceComplete: false,
      isHidden: false,
    });
  });

  describe('initial state', () => {
    it('should have isExpanded set to true', () => {
      const state = useToolbarStore.getState();
      expect(state.isExpanded).toBe(true);
    });

    it('should have addMode set to idle', () => {
      const state = useToolbarStore.getState();
      expect(state.addMode).toBe('idle');
    });

    it('should have selectedCategory set to suggestion', () => {
      const state = useToolbarStore.getState();
      expect(state.selectedCategory).toBe('suggestion');
    });

    it('should have null pendingAnnotation', () => {
      const state = useToolbarStore.getState();
      expect(state.pendingAnnotation).toBeNull();
    });

    it('should have null selectedAnnotationId', () => {
      const state = useToolbarStore.getState();
      expect(state.selectedAnnotationId).toBeNull();
    });

    it('should have isExportModalOpen set to false', () => {
      const state = useToolbarStore.getState();
      expect(state.isExportModalOpen).toBe(false);
    });

    it('should have isEntranceComplete set to false', () => {
      const state = useToolbarStore.getState();
      expect(state.isEntranceComplete).toBe(false);
    });

    it('should have isHidden set to false', () => {
      const state = useToolbarStore.getState();
      expect(state.isHidden).toBe(false);
    });
  });

  describe('toolbarExpanded / toolbarCollapsed', () => {
    it('should expand toolbar', () => {
      useToolbarStore.setState({ isExpanded: false });
      useToolbarStore.getState().toolbarExpanded();
      expect(useToolbarStore.getState().isExpanded).toBe(true);
    });

    it('should collapse toolbar', () => {
      useToolbarStore.getState().toolbarCollapsed();
      expect(useToolbarStore.getState().isExpanded).toBe(false);
    });
  });

  describe('categoryPanelOpened / categoryPanelClosed', () => {
    it('should open category panel', () => {
      useToolbarStore.getState().categoryPanelOpened();
      expect(useToolbarStore.getState().addMode).toBe('category');
    });

    it('should close category panel and return to idle', () => {
      useToolbarStore.setState({ addMode: 'category' });
      useToolbarStore.getState().categoryPanelClosed();
      expect(useToolbarStore.getState().addMode).toBe('idle');
    });

    it('should clear pendingAnnotation when opening panel', () => {
      useToolbarStore.setState({ pendingAnnotation: mockPendingAnnotation });
      useToolbarStore.getState().categoryPanelOpened();
      expect(useToolbarStore.getState().pendingAnnotation).toBeNull();
    });
  });

  describe('categorySelected', () => {
    it('should set selected category', () => {
      useToolbarStore.getState().categorySelected('bug');
      expect(useToolbarStore.getState().selectedCategory).toBe('bug');
    });

    it('should enter selecting mode', () => {
      useToolbarStore.getState().categorySelected('accessibility');
      expect(useToolbarStore.getState().addMode).toBe('selecting');
    });

    it('should clear pending annotation', () => {
      useToolbarStore.setState({ pendingAnnotation: mockPendingAnnotation });
      useToolbarStore.getState().categorySelected('question');
      expect(useToolbarStore.getState().pendingAnnotation).toBeNull();
    });
  });

  describe('selectionModeEntered / selectionModeCancelled', () => {
    it('should enter selection mode', () => {
      useToolbarStore.getState().selectionModeEntered();
      expect(useToolbarStore.getState().addMode).toBe('selecting');
    });

    it('should cancel selection mode and return to idle', () => {
      useToolbarStore.setState({ addMode: 'selecting' });
      useToolbarStore.getState().selectionModeCancelled();
      expect(useToolbarStore.getState().addMode).toBe('idle');
    });

    it('should clear pending annotation when cancelling', () => {
      useToolbarStore.setState({
        addMode: 'selecting',
        pendingAnnotation: mockPendingAnnotation,
      });
      useToolbarStore.getState().selectionModeCancelled();
      expect(useToolbarStore.getState().pendingAnnotation).toBeNull();
    });
  });

  describe('elementSelected', () => {
    it('should set pending annotation', () => {
      useToolbarStore.getState().elementSelected(mockPendingAnnotation);
      expect(useToolbarStore.getState().pendingAnnotation).toEqual(mockPendingAnnotation);
    });

    it('should return to idle mode', () => {
      useToolbarStore.setState({ addMode: 'selecting' });
      useToolbarStore.getState().elementSelected(mockPendingAnnotation);
      expect(useToolbarStore.getState().addMode).toBe('idle');
    });
  });

  describe('pendingAnnotationCleared', () => {
    it('should clear pending annotation', () => {
      useToolbarStore.setState({ pendingAnnotation: mockPendingAnnotation });
      useToolbarStore.getState().pendingAnnotationCleared();
      expect(useToolbarStore.getState().pendingAnnotation).toBeNull();
    });
  });

  describe('annotationSelected / annotationDeselected', () => {
    it('should select annotation by id', () => {
      useToolbarStore.getState().annotationSelected('test-id-123');
      expect(useToolbarStore.getState().selectedAnnotationId).toBe('test-id-123');
    });

    it('should deselect annotation', () => {
      useToolbarStore.setState({ selectedAnnotationId: 'test-id-123' });
      useToolbarStore.getState().annotationDeselected();
      expect(useToolbarStore.getState().selectedAnnotationId).toBeNull();
    });
  });

  describe('exportModalOpened / exportModalClosed', () => {
    it('should open export modal', () => {
      useToolbarStore.getState().exportModalOpened();
      expect(useToolbarStore.getState().isExportModalOpen).toBe(true);
    });

    it('should close export modal', () => {
      useToolbarStore.setState({ isExportModalOpen: true });
      useToolbarStore.getState().exportModalClosed();
      expect(useToolbarStore.getState().isExportModalOpen).toBe(false);
    });
  });

  describe('entranceCompleted', () => {
    it('should mark entrance animation as complete', () => {
      useToolbarStore.getState().entranceCompleted();
      expect(useToolbarStore.getState().isEntranceComplete).toBe(true);
    });
  });

  describe('uiHidden / uiShown', () => {
    it('should hide UI', () => {
      useToolbarStore.getState().uiHidden();
      expect(useToolbarStore.getState().isHidden).toBe(true);
    });

    it('should show UI', () => {
      useToolbarStore.setState({ isHidden: true });
      useToolbarStore.getState().uiShown();
      expect(useToolbarStore.getState().isHidden).toBe(false);
    });
  });

  describe('toggleCategoryPanel', () => {
    it('should open panel when idle', () => {
      useToolbarStore.getState().toggleCategoryPanel();
      expect(useToolbarStore.getState().addMode).toBe('category');
    });

    it('should close panel when open', () => {
      useToolbarStore.setState({ addMode: 'category' });
      useToolbarStore.getState().toggleCategoryPanel();
      expect(useToolbarStore.getState().addMode).toBe('idle');
    });

    it('should return to idle when in selecting mode', () => {
      useToolbarStore.setState({ addMode: 'selecting' });
      useToolbarStore.getState().toggleCategoryPanel();
      expect(useToolbarStore.getState().addMode).toBe('idle');
    });

    it('should clear pending annotation when toggling', () => {
      useToolbarStore.setState({
        addMode: 'idle',
        pendingAnnotation: mockPendingAnnotation,
      });
      useToolbarStore.getState().toggleCategoryPanel();
      expect(useToolbarStore.getState().pendingAnnotation).toBeNull();
    });
  });
});
