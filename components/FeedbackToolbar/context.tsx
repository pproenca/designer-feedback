/**
 * AnnotationContext - Centralized state management for annotation toolbar
 *
 * This context provides:
 * - Toolbar state (expanded, add mode, selected category)
 * - Hover information during element selection
 * - Pending annotation data before submission
 * - Selected annotation for viewing
 * - Export modal state
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { FeedbackCategory, Annotation } from '@/types';

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

// =============================================================================
// Context
// =============================================================================

interface AnnotationContextValue {
  // Toolbar state
  state: ToolbarState;
  dispatch: Dispatch<ToolbarAction>;

  // Annotations (managed separately for storage sync)
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;

  // Computed values
  isSelectingElement: boolean;
  isCategoryPanelOpen: boolean;
  selectedAnnotation: Annotation | null;

  // Actions
  selectAnnotation: (id: string | null) => void;
  openExportModal: () => void;
  closeExportModal: () => void;
}

const AnnotationContext = createContext<AnnotationContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface AnnotationProviderProps {
  children: ReactNode;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
}

export function AnnotationProvider({
  children,
  annotations,
  onAnnotationsChange,
}: AnnotationProviderProps) {
  const [state, dispatch] = useReducer(toolbarReducer, initialToolbarState);

  // Computed values
  const isSelectingElement = state.addMode === 'selecting';
  const isCategoryPanelOpen = state.addMode === 'category';

  const selectedAnnotation = useMemo(
    () => annotations.find((a) => a.id === state.selectedAnnotationId) ?? null,
    [annotations, state.selectedAnnotationId]
  );

  // Actions
  const selectAnnotation = useCallback((id: string | null) => {
    dispatch({ type: 'setSelectedAnnotationId', value: id });
  }, []);

  const openExportModal = useCallback(() => {
    dispatch({ type: 'setExportModalOpen', value: true });
  }, []);

  const closeExportModal = useCallback(() => {
    dispatch({ type: 'setExportModalOpen', value: false });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AnnotationContextValue>(
    () => ({
      state,
      dispatch,
      annotations,
      setAnnotations: onAnnotationsChange,
      isSelectingElement,
      isCategoryPanelOpen,
      selectedAnnotation,
      selectAnnotation,
      openExportModal,
      closeExportModal,
    }),
    [
      state,
      annotations,
      onAnnotationsChange,
      isSelectingElement,
      isCategoryPanelOpen,
      selectedAnnotation,
      selectAnnotation,
      openExportModal,
      closeExportModal,
    ]
  );

  return (
    <AnnotationContext.Provider value={contextValue}>
      {children}
    </AnnotationContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useAnnotationContext(): AnnotationContextValue {
  const context = useContext(AnnotationContext);
  if (!context) {
    throw new Error('useAnnotationContext must be used within an AnnotationProvider');
  }
  return context;
}
