import {describe, it, expect} from 'vitest';
import {toolbarReducer, initialToolbarState} from './ToolbarStateProvider';
import type {PendingAnnotation} from './context';

const mockPendingAnnotation: PendingAnnotation = {
  x: 100,
  y: 200,
  element: 'div',
  elementPath: 'body > div',
  target: {} as HTMLElement,
  rect: {x: 0, y: 0, width: 100, height: 50} as DOMRect,
  isFixed: false,
  scrollX: 0,
  scrollY: 0,
};

describe('toolbarReducer', () => {
  it('uses the expected initial defaults', () => {
    expect(initialToolbarState).toMatchObject({
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

  it('expands and collapses the toolbar', () => {
    const collapsed = toolbarReducer(
      {...initialToolbarState, isExpanded: true},
      {type: 'toolbarCollapsed'}
    );
    expect(collapsed.isExpanded).toBe(false);

    const expanded = toolbarReducer(
      {...collapsed, isExpanded: false},
      {type: 'toolbarExpanded'}
    );
    expect(expanded.isExpanded).toBe(true);
  });

  it('opens and closes the category panel', () => {
    const opened = toolbarReducer(initialToolbarState, {
      type: 'categoryPanelOpened',
    });
    expect(opened.addMode).toBe('category');
    expect(opened.pendingAnnotation).toBeNull();

    const closed = toolbarReducer(
      {...opened, addMode: 'category'},
      {type: 'categoryPanelClosed'}
    );
    expect(closed.addMode).toBe('idle');
  });

  it('selects category and enters selection mode', () => {
    const selected = toolbarReducer(initialToolbarState, {
      type: 'categorySelected',
      category: 'bug',
    });
    expect(selected.selectedCategory).toBe('bug');
    expect(selected.addMode).toBe('selecting');
    expect(selected.pendingAnnotation).toBeNull();
  });

  it('enters and cancels selection mode', () => {
    const selecting = toolbarReducer(initialToolbarState, {
      type: 'selectionModeEntered',
    });
    expect(selecting.addMode).toBe('selecting');

    const cancelled = toolbarReducer(
      {...selecting, pendingAnnotation: mockPendingAnnotation},
      {type: 'selectionModeCancelled'}
    );
    expect(cancelled.addMode).toBe('idle');
    expect(cancelled.pendingAnnotation).toBeNull();
  });

  it('sets and clears pending annotations', () => {
    const withPending = toolbarReducer(initialToolbarState, {
      type: 'elementSelected',
      pending: mockPendingAnnotation,
    });
    expect(withPending.pendingAnnotation).toEqual(mockPendingAnnotation);
    expect(withPending.addMode).toBe('idle');

    const cleared = toolbarReducer(withPending, {
      type: 'pendingAnnotationCleared',
    });
    expect(cleared.pendingAnnotation).toBeNull();
  });

  it('selects and deselects annotations', () => {
    const selected = toolbarReducer(initialToolbarState, {
      type: 'annotationSelected',
      id: 'test-id-123',
    });
    expect(selected.selectedAnnotationId).toBe('test-id-123');

    const deselected = toolbarReducer(selected, {type: 'annotationDeselected'});
    expect(deselected.selectedAnnotationId).toBeNull();
  });

  it('opens and closes the export modal', () => {
    const opened = toolbarReducer(initialToolbarState, {
      type: 'exportModalOpened',
    });
    expect(opened.isExportModalOpen).toBe(true);

    const closed = toolbarReducer(opened, {type: 'exportModalClosed'});
    expect(closed.isExportModalOpen).toBe(false);
  });

  it('marks entrance completion and toggles visibility', () => {
    const completed = toolbarReducer(initialToolbarState, {
      type: 'entranceCompleted',
    });
    expect(completed.isEntranceComplete).toBe(true);

    const hidden = toolbarReducer(initialToolbarState, {type: 'uiHidden'});
    expect(hidden.isHidden).toBe(true);

    const shown = toolbarReducer(hidden, {type: 'uiShown'});
    expect(shown.isHidden).toBe(false);
  });

  it('toggles category panel based on mode', () => {
    const opened = toolbarReducer(initialToolbarState, {
      type: 'toggleCategoryPanel',
    });
    expect(opened.addMode).toBe('category');
    expect(opened.pendingAnnotation).toBeNull();

    const closed = toolbarReducer(opened, {type: 'toggleCategoryPanel'});
    expect(closed.addMode).toBe('idle');

    const fromSelecting = toolbarReducer(
      {...initialToolbarState, addMode: 'selecting'},
      {type: 'toggleCategoryPanel'}
    );
    expect(fromSelecting.addMode).toBe('idle');
  });
});
