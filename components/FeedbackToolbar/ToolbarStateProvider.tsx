/**
 * ToolbarStateProvider
 *
 * Local state container for the feedback toolbar UI.
 * Replaces global Zustand store with a colocated reducer + context.
 */

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { FeedbackCategory } from '@/types';
import type { PendingAnnotation, AddMode } from './context';

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
  toolbarExpanded: () => void;
  toolbarCollapsed: () => void;
  categoryPanelOpened: () => void;
  categoryPanelClosed: () => void;
  categorySelected: (category: FeedbackCategory) => void;
  selectionModeEntered: () => void;
  selectionModeCancelled: () => void;
  elementSelected: (pending: PendingAnnotation) => void;
  pendingAnnotationCleared: () => void;
  annotationSelected: (id: string) => void;
  annotationDeselected: () => void;
  exportModalOpened: () => void;
  exportModalClosed: () => void;
  entranceCompleted: () => void;
  uiHidden: () => void;
  uiShown: () => void;
  toggleCategoryPanel: () => void;
}

type ToolbarAction =
  | { type: 'toolbarExpanded' }
  | { type: 'toolbarCollapsed' }
  | { type: 'categoryPanelOpened' }
  | { type: 'categoryPanelClosed' }
  | { type: 'categorySelected'; category: FeedbackCategory }
  | { type: 'selectionModeEntered' }
  | { type: 'selectionModeCancelled' }
  | { type: 'elementSelected'; pending: PendingAnnotation }
  | { type: 'pendingAnnotationCleared' }
  | { type: 'annotationSelected'; id: string }
  | { type: 'annotationDeselected' }
  | { type: 'exportModalOpened' }
  | { type: 'exportModalClosed' }
  | { type: 'entranceCompleted' }
  | { type: 'uiHidden' }
  | { type: 'uiShown' }
  | { type: 'toggleCategoryPanel' };

// =============================================================================
// Initial State
// =============================================================================

export const initialToolbarState: ToolbarState = {
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
// Reducer
// =============================================================================

export function toolbarReducer(state: ToolbarState, action: ToolbarAction): ToolbarState {
  switch (action.type) {
    case 'toolbarExpanded':
      return { ...state, isExpanded: true };
    case 'toolbarCollapsed':
      return { ...state, isExpanded: false };
    case 'categoryPanelOpened':
      return { ...state, addMode: 'category', pendingAnnotation: null };
    case 'categoryPanelClosed':
      return { ...state, addMode: 'idle' };
    case 'categorySelected':
      return {
        ...state,
        selectedCategory: action.category,
        addMode: 'selecting',
        pendingAnnotation: null,
      };
    case 'selectionModeEntered':
      return { ...state, addMode: 'selecting' };
    case 'selectionModeCancelled':
      return { ...state, addMode: 'idle', pendingAnnotation: null };
    case 'elementSelected':
      return { ...state, pendingAnnotation: action.pending, addMode: 'idle' };
    case 'pendingAnnotationCleared':
      return { ...state, pendingAnnotation: null };
    case 'annotationSelected':
      return { ...state, selectedAnnotationId: action.id };
    case 'annotationDeselected':
      return { ...state, selectedAnnotationId: null };
    case 'exportModalOpened':
      return { ...state, isExportModalOpen: true };
    case 'exportModalClosed':
      return { ...state, isExportModalOpen: false };
    case 'entranceCompleted':
      return { ...state, isEntranceComplete: true };
    case 'uiHidden':
      return { ...state, isHidden: true };
    case 'uiShown':
      return { ...state, isHidden: false };
    case 'toggleCategoryPanel': {
      const nextMode =
        state.addMode === 'category' || state.addMode === 'selecting' ? 'idle' : 'category';
      return { ...state, addMode: nextMode, pendingAnnotation: null };
    }
    default:
      return state;
  }
}

// =============================================================================
// Context + Provider
// =============================================================================

const ToolbarStateContext = createContext<ToolbarState | null>(null);
const ToolbarActionsContext = createContext<ToolbarActions | null>(null);

interface ToolbarStateProviderProps {
  children: ReactNode;
  initialState?: Partial<ToolbarState>;
}

export function ToolbarStateProvider({ children, initialState }: ToolbarStateProviderProps) {
  const [state, dispatch] = useReducer(
    toolbarReducer,
    initialToolbarState,
    (baseState) => ({ ...baseState, ...initialState })
  );

  const actions = useMemo<ToolbarActions>(() => ({
    toolbarExpanded: () => dispatch({ type: 'toolbarExpanded' }),
    toolbarCollapsed: () => dispatch({ type: 'toolbarCollapsed' }),
    categoryPanelOpened: () => dispatch({ type: 'categoryPanelOpened' }),
    categoryPanelClosed: () => dispatch({ type: 'categoryPanelClosed' }),
    categorySelected: (category) => dispatch({ type: 'categorySelected', category }),
    selectionModeEntered: () => dispatch({ type: 'selectionModeEntered' }),
    selectionModeCancelled: () => dispatch({ type: 'selectionModeCancelled' }),
    elementSelected: (pending) => dispatch({ type: 'elementSelected', pending }),
    pendingAnnotationCleared: () => dispatch({ type: 'pendingAnnotationCleared' }),
    annotationSelected: (id) => dispatch({ type: 'annotationSelected', id }),
    annotationDeselected: () => dispatch({ type: 'annotationDeselected' }),
    exportModalOpened: () => dispatch({ type: 'exportModalOpened' }),
    exportModalClosed: () => dispatch({ type: 'exportModalClosed' }),
    entranceCompleted: () => dispatch({ type: 'entranceCompleted' }),
    uiHidden: () => dispatch({ type: 'uiHidden' }),
    uiShown: () => dispatch({ type: 'uiShown' }),
    toggleCategoryPanel: () => dispatch({ type: 'toggleCategoryPanel' }),
  }), [dispatch]);

  return (
    <ToolbarStateContext.Provider value={state}>
      <ToolbarActionsContext.Provider value={actions}>
        {children}
      </ToolbarActionsContext.Provider>
    </ToolbarStateContext.Provider>
  );
}

export function useToolbarState(): ToolbarState {
  const state = useContext(ToolbarStateContext);
  if (!state) {
    throw new Error('useToolbarState must be used within ToolbarStateProvider');
  }
  return state;
}

export function useToolbarActions(): ToolbarActions {
  const actions = useContext(ToolbarActionsContext);
  if (!actions) {
    throw new Error('useToolbarActions must be used within ToolbarStateProvider');
  }
  return actions;
}
