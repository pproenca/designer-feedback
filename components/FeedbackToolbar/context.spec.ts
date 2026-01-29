import { describe, it, expect } from 'vitest';

// Tests for AnnotationContext reducer and state management

describe('toolbarReducer', () => {
  describe('setExpanded action', () => {
    it('sets isExpanded to true', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setExpanded',
        value: true,
      });

      expect(result.isExpanded).toBe(true);
    });

    it('sets isExpanded to false', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const state = { ...initialToolbarState, isExpanded: true };
      const result = toolbarReducer(state, {
        type: 'setExpanded',
        value: false,
      });

      expect(result.isExpanded).toBe(false);
    });
  });

  describe('setAddMode action', () => {
    it('sets addMode to selecting', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setAddMode',
        value: 'selecting',
      });

      expect(result.addMode).toBe('selecting');
    });

    it('sets addMode to category', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setAddMode',
        value: 'category',
      });

      expect(result.addMode).toBe('category');
    });

    it('sets addMode to idle', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const state = { ...initialToolbarState, addMode: 'selecting' as const };
      const result = toolbarReducer(state, {
        type: 'setAddMode',
        value: 'idle',
      });

      expect(result.addMode).toBe('idle');
    });

    it('clears hoverInfo when exiting selecting mode', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const state = {
        ...initialToolbarState,
        addMode: 'selecting' as const,
        hoverInfo: { element: 'div' },
      };
      const result = toolbarReducer(state, {
        type: 'setAddMode',
        value: 'idle',
      });

      expect(result.hoverInfo).toBeNull();
    });

    it('preserves hoverInfo when staying in selecting mode', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const hoverInfo = { element: 'div' };
      const state = {
        ...initialToolbarState,
        addMode: 'selecting' as const,
        hoverInfo,
      };
      const result = toolbarReducer(state, {
        type: 'setAddMode',
        value: 'selecting',
      });

      expect(result.hoverInfo).toBe(hoverInfo);
    });

    it('clears pendingAnnotation when entering selecting or category mode', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const pendingAnnotation = {
        x: 100,
        y: 200,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(100, 200, 50, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const state = { ...initialToolbarState, pendingAnnotation };
      const result = toolbarReducer(state, {
        type: 'setAddMode',
        value: 'selecting',
      });

      expect(result.pendingAnnotation).toBeNull();
    });
  });

  describe('setSelectedCategory action', () => {
    it('sets selectedCategory to bug', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setSelectedCategory',
        value: 'bug',
      });

      expect(result.selectedCategory).toBe('bug');
    });

    it('sets selectedCategory to accessibility', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setSelectedCategory',
        value: 'accessibility',
      });

      expect(result.selectedCategory).toBe('accessibility');
    });
  });

  describe('setHoverInfo action', () => {
    it('sets hoverInfo with element name', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const hoverInfo = { element: 'button.primary' };
      const result = toolbarReducer(initialToolbarState, {
        type: 'setHoverInfo',
        value: hoverInfo,
      });

      expect(result.hoverInfo).toEqual(hoverInfo);
    });

    it('clears hoverInfo when value is null', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const state = {
        ...initialToolbarState,
        hoverInfo: { element: 'div' },
      };
      const result = toolbarReducer(state, {
        type: 'setHoverInfo',
        value: null,
      });

      expect(result.hoverInfo).toBeNull();
    });
  });

  describe('setPendingAnnotation action', () => {
    it('sets pendingAnnotation and transitions to idle mode', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const pendingAnnotation = {
        x: 100,
        y: 200,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(100, 200, 50, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const state = { ...initialToolbarState, addMode: 'selecting' as const };
      const result = toolbarReducer(state, {
        type: 'setPendingAnnotation',
        value: pendingAnnotation,
      });

      expect(result.pendingAnnotation).toEqual(pendingAnnotation);
      expect(result.addMode).toBe('idle');
      expect(result.hoverInfo).toBeNull();
    });

    it('clears pendingAnnotation when value is null', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const pendingAnnotation = {
        x: 100,
        y: 200,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(100, 200, 50, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const state = { ...initialToolbarState, pendingAnnotation };
      const result = toolbarReducer(state, {
        type: 'setPendingAnnotation',
        value: null,
      });

      expect(result.pendingAnnotation).toBeNull();
    });

    it('does not change addMode when clearing pendingAnnotation', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const pendingAnnotation = {
        x: 100,
        y: 200,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(100, 200, 50, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const state = {
        ...initialToolbarState,
        pendingAnnotation,
        addMode: 'idle' as const,
      };
      const result = toolbarReducer(state, {
        type: 'setPendingAnnotation',
        value: null,
      });

      expect(result.addMode).toBe('idle');
    });
  });

  describe('setSelectedAnnotationId action', () => {
    it('sets selectedAnnotationId', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setSelectedAnnotationId',
        value: 'annotation-123',
      });

      expect(result.selectedAnnotationId).toBe('annotation-123');
    });

    it('clears selectedAnnotationId when value is null', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const state = {
        ...initialToolbarState,
        selectedAnnotationId: 'annotation-123',
      };
      const result = toolbarReducer(state, {
        type: 'setSelectedAnnotationId',
        value: null,
      });

      expect(result.selectedAnnotationId).toBeNull();
    });
  });

  describe('setExportModalOpen action', () => {
    it('opens export modal', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setExportModalOpen',
        value: true,
      });

      expect(result.isExportModalOpen).toBe(true);
    });

    it('closes export modal', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const state = { ...initialToolbarState, isExportModalOpen: true };
      const result = toolbarReducer(state, {
        type: 'setExportModalOpen',
        value: false,
      });

      expect(result.isExportModalOpen).toBe(false);
    });
  });

  describe('setEntranceComplete action', () => {
    it('sets entranceComplete to true', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setEntranceComplete',
        value: true,
      });

      expect(result.isEntranceComplete).toBe(true);
    });
  });

  describe('setHidden action', () => {
    it('sets isHidden to true', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setHidden',
        value: true,
      });

      expect(result.isHidden).toBe(true);
    });

    it('sets isHidden to false', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const state = { ...initialToolbarState, isHidden: true };
      const result = toolbarReducer(state, {
        type: 'setHidden',
        value: false,
      });

      expect(result.isHidden).toBe(false);
    });
  });

  describe('state immutability', () => {
    it('returns new state object on change', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'setExpanded',
        value: false,
      });

      expect(result).not.toBe(initialToolbarState);
    });

    it('does not mutate original state', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const originalExpanded = initialToolbarState.isExpanded;
      toolbarReducer(initialToolbarState, {
        type: 'setExpanded',
        value: !originalExpanded,
      });

      expect(initialToolbarState.isExpanded).toBe(originalExpanded);
    });
  });

  describe('unknown action type', () => {
    it('returns current state for unknown action', async () => {
      const { toolbarReducer, initialToolbarState } = await import('./context');

      const result = toolbarReducer(initialToolbarState, {
        type: 'unknownAction' as 'setExpanded',
        value: true,
      });

      expect(result).toBe(initialToolbarState);
    });
  });
});

describe('initialToolbarState', () => {
  it('has correct default values', async () => {
    const { initialToolbarState } = await import('./context');

    expect(initialToolbarState).toEqual({
      isExpanded: true,
      addMode: 'idle',
      selectedCategory: 'suggestion',
      hoverInfo: null,
      pendingAnnotation: null,
      selectedAnnotationId: null,
      isExportModalOpen: false,
      isEntranceComplete: false,
      isHidden: false,
    });
  });
});
