/**
 * MarkerDragContext - Context for marker drag state
 *
 * Eliminates prop drilling of drag state from AnnotationLayer to MarkerLayer.
 * Provides drag state and handlers via context instead of props.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { Annotation } from '@/types';
import type { Position, MarkerHandlers } from '@/hooks/useMarkerDrag';

// =============================================================================
// Types
// =============================================================================

interface MarkerDragContextValue {
  /** Whether a drag is in progress */
  isDragging: boolean;
  /** ID of the annotation being dragged, null if not dragging */
  draggedAnnotationId: string | null;
  /** Current position during drag, null if not dragging */
  currentDragPosition: Position | null;
  /** Get handlers to attach to a marker */
  getMarkerDragHandlers: (annotation: Annotation) => MarkerHandlers;
}

// =============================================================================
// Context
// =============================================================================

const MarkerDragContext = createContext<MarkerDragContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface MarkerDragProviderProps {
  children: ReactNode;
  value: MarkerDragContextValue;
}

export function MarkerDragProvider({ children, value }: MarkerDragProviderProps) {
  return <MarkerDragContext.Provider value={value}>{children}</MarkerDragContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

export function useMarkerDragContext(): MarkerDragContextValue {
  const context = useContext(MarkerDragContext);
  if (!context) {
    throw new Error('useMarkerDragContext must be used within a MarkerDragProvider');
  }
  return context;
}
