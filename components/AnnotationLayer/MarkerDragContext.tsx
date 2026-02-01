import { createContext, useContext, type ReactNode } from 'react';
import type { Annotation } from '@/types';
import type { Position } from '@/types/position';
import type { MarkerHandlers } from '@/hooks/useMarkerDrag';

interface MarkerDragContextValue {

  isDragging: boolean;

  draggedAnnotationId: string | null;

  currentDragPosition: Position | null;

  getMarkerDragHandlers: (annotation: Annotation) => MarkerHandlers;
}

const MarkerDragContext = createContext<MarkerDragContextValue | null>(null);

interface MarkerDragProviderProps {
  children: ReactNode;
  value: MarkerDragContextValue;
}

export function MarkerDragProvider({ children, value }: MarkerDragProviderProps) {
  return <MarkerDragContext.Provider value={value}>{children}</MarkerDragContext.Provider>;
}

export function useMarkerDragContext(): MarkerDragContextValue {
  const context = useContext(MarkerDragContext);
  if (!context) {
    throw new Error('useMarkerDragContext must be used within a MarkerDragProvider');
  }
  return context;
}
