/**
 * Toolbar Store
 *
 * Manages toolbar UI state including expansion, category selection,
 * element selection mode, and annotation popup state.
 * Uses event-style action naming per Zustand best practices.
 */

import { create } from 'zustand';
import type { FeedbackCategory } from '@/types';
import type { PendingAnnotation, AddMode } from '@/components/FeedbackToolbar/context';

// =============================================================================
// Types
// =============================================================================

export interface ToolbarState {
  isExpanded: boolean;
  addMode: AddMode;
  selectedCategory: FeedbackCategory;
  pendingAnnotation: PendingAnnotation | null;
  selectedAnnotationId: string | null;
  isExportModalOpen: boolean;
  isEntranceComplete: boolean;
  isHidden: boolean;
}

export interface ToolbarActions {
  /** Expand the toolbar */
  toolbarExpanded: () => void;
  /** Collapse the toolbar */
  toolbarCollapsed: () => void;
  /** Open the category selection panel */
  categoryPanelOpened: () => void;
  /** Close the category selection panel */
  categoryPanelClosed: () => void;
  /** Select a category and enter element selection mode */
  categorySelected: (category: FeedbackCategory) => void;
  /** Enter element selection mode */
  selectionModeEntered: () => void;
  /** Cancel element selection mode */
  selectionModeCancelled: () => void;
  /** Set pending annotation after element selection */
  elementSelected: (pending: PendingAnnotation) => void;
  /** Clear pending annotation */
  pendingAnnotationCleared: () => void;
  /** Select an annotation for viewing */
  annotationSelected: (id: string) => void;
  /** Deselect the current annotation */
  annotationDeselected: () => void;
  /** Open the export modal */
  exportModalOpened: () => void;
  /** Close the export modal */
  exportModalClosed: () => void;
  /** Mark entrance animation as complete */
  entranceCompleted: () => void;
  /** Hide the UI (for screenshots) */
  uiHidden: () => void;
  /** Show the UI */
  uiShown: () => void;
  /** Toggle category panel (convenience action) */
  toggleCategoryPanel: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: ToolbarState = {
  isExpanded: true,
  addMode: 'idle',
  selectedCategory: 'suggestion',
  pendingAnnotation: null,
  selectedAnnotationId: null,
  isExportModalOpen: false,
  isEntranceComplete: false,
  isHidden: false,
};

// =============================================================================
// Store
// =============================================================================

export const useToolbarStore = create<ToolbarState & ToolbarActions>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  toolbarExpanded: () => set({ isExpanded: true }),

  toolbarCollapsed: () => set({ isExpanded: false }),

  categoryPanelOpened: () =>
    set({
      addMode: 'category',
      pendingAnnotation: null,
    }),

  categoryPanelClosed: () => set({ addMode: 'idle' }),

  categorySelected: (category: FeedbackCategory) =>
    set({
      selectedCategory: category,
      addMode: 'selecting',
      pendingAnnotation: null,
    }),

  selectionModeEntered: () => set({ addMode: 'selecting' }),

  selectionModeCancelled: () =>
    set({
      addMode: 'idle',
      pendingAnnotation: null,
    }),

  elementSelected: (pending: PendingAnnotation) =>
    set({
      pendingAnnotation: pending,
      addMode: 'idle',
    }),

  pendingAnnotationCleared: () => set({ pendingAnnotation: null }),

  annotationSelected: (id: string) => set({ selectedAnnotationId: id }),

  annotationDeselected: () => set({ selectedAnnotationId: null }),

  exportModalOpened: () => set({ isExportModalOpen: true }),

  exportModalClosed: () => set({ isExportModalOpen: false }),

  entranceCompleted: () => set({ isEntranceComplete: true }),

  uiHidden: () => set({ isHidden: true }),

  uiShown: () => set({ isHidden: false }),

  toggleCategoryPanel: () => {
    const { addMode } = get();
    const nextMode = addMode === 'category' || addMode === 'selecting' ? 'idle' : 'category';
    set({ addMode: nextMode, pendingAnnotation: null });
  },
}));
