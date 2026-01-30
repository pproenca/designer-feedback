/**
 * Toolbar Types and Legacy Reducer
 *
 * This module provides types for toolbar state. The reducer and initial state
 * are kept for backwards compatibility but are no longer used in the main
 * component - state management has been migrated to Zustand stores in
 * `stores/toolbar.ts` and `stores/annotations.ts`.
 *
 * @see stores/toolbar.ts - Zustand store for toolbar UI state
 * @see stores/annotations.ts - Zustand store for annotations data
 */

import type { FeedbackCategory } from '@/types';

// =============================================================================
// Types
// =============================================================================

export type HoverInfo = {
  element: string;
};

export type PendingAnnotation = {
  x: number;
  y: number;
  element: string;
  elementPath: string;
  target: HTMLElement;
  rect: DOMRect;
  isFixed: boolean;
  scrollX: number;
  scrollY: number;
};

export type AddMode = 'idle' | 'category' | 'selecting';

export type ToolbarState = {
  isExpanded: boolean;
  addMode: AddMode;
  selectedCategory: FeedbackCategory;
  hoverInfo: HoverInfo | null;
  pendingAnnotation: PendingAnnotation | null;
  selectedAnnotationId: string | null;
  isExportModalOpen: boolean;
  isEntranceComplete: boolean;
  isHidden: boolean;
};

export type ToolbarAction =
  | { type: 'setExpanded'; value: boolean }
  | { type: 'setAddMode'; value: AddMode }
  | { type: 'setSelectedCategory'; value: FeedbackCategory }
  | { type: 'setHoverInfo'; value: HoverInfo | null }
  | { type: 'setPendingAnnotation'; value: PendingAnnotation | null }
  | { type: 'setSelectedAnnotationId'; value: string | null }
  | { type: 'setExportModalOpen'; value: boolean }
  | { type: 'setEntranceComplete'; value: boolean }
  | { type: 'setHidden'; value: boolean };

// =============================================================================
// Initial State
// =============================================================================

export const initialToolbarState: ToolbarState = {
  isExpanded: true,
  addMode: 'idle',
  selectedCategory: 'suggestion',
  hoverInfo: null,
  pendingAnnotation: null,
  selectedAnnotationId: null,
  isExportModalOpen: false,
  isEntranceComplete: false,
  isHidden: false,
};

// =============================================================================
// Reducer
// =============================================================================

export function toolbarReducer(state: ToolbarState, action: ToolbarAction): ToolbarState {
  switch (action.type) {
    case 'setExpanded':
      return { ...state, isExpanded: action.value };

    case 'setAddMode': {
      const addMode = action.value;
      return {
        ...state,
        addMode,
        // Clear hoverInfo when exiting selecting mode
        hoverInfo: addMode === 'selecting' ? state.hoverInfo : null,
        // Clear pendingAnnotation when entering selecting or category mode
        pendingAnnotation:
          addMode === 'selecting' || addMode === 'category' ? null : state.pendingAnnotation,
      };
    }

    case 'setSelectedCategory':
      return { ...state, selectedCategory: action.value };

    case 'setHoverInfo':
      return { ...state, hoverInfo: action.value };

    case 'setPendingAnnotation':
      // When setting a pending annotation, transition to idle mode and clear hover
      return action.value
        ? { ...state, pendingAnnotation: action.value, addMode: 'idle', hoverInfo: null }
        : { ...state, pendingAnnotation: null };

    case 'setSelectedAnnotationId':
      return { ...state, selectedAnnotationId: action.value };

    case 'setExportModalOpen':
      return { ...state, isExportModalOpen: action.value };

    case 'setEntranceComplete':
      return { ...state, isEntranceComplete: action.value };

    case 'setHidden':
      return { ...state, isHidden: action.value };

    default:
      return state;
  }
}
