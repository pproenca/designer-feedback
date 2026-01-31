/**
 * AnnotationLayer - Container for rendering annotation markers
 *
 * This component composes MarkerLayer, PendingMarker, and DragHighlight
 * to render all annotation markers on the page with drag-to-reposition support.
 */

import { useCallback } from 'react';
import { MarkerLayer } from './MarkerLayer';
import { PendingMarker } from './PendingMarker';
import { DragHighlight } from './DragHighlight';
import { useAnnotationsStore } from '@/stores/annotations';
import { useToolbarActions, useToolbarState } from '@/components/FeedbackToolbar/ToolbarStateProvider';
import { useMarkerDrag } from '@/hooks/useMarkerDrag';
import type { Position } from '@/hooks/useMarkerDrag';

// =============================================================================
// Component
// =============================================================================

export function AnnotationLayer() {
  const annotations = useAnnotationsStore((s) => s.annotations);
  const annotationUpdated = useAnnotationsStore((s) => s.annotationUpdated);
  const { pendingAnnotation, isEntranceComplete, selectedAnnotationId } = useToolbarState();
  const { annotationSelected } = useToolbarActions();

  // Disable dragging when popup is open (an annotation is selected)
  const isDragDisabled = selectedAnnotationId !== null;

  const handleDragEnd = useCallback(
    (annotationId: string, position: Position) => {
      annotationUpdated(annotationId, { x: position.x, y: position.y });
    },
    [annotationUpdated]
  );

  const handleClick = useCallback(
    (annotationId: string) => {
      annotationSelected(annotationId);
    },
    [annotationSelected]
  );

  const {
    isDragging,
    draggedAnnotationId,
    draggedAnnotation,
    currentDragPosition,
    getMarkerHandlers,
  } = useMarkerDrag({
    onClick: handleClick,
    onDragEnd: handleDragEnd,
    disabled: isDragDisabled,
  });

  // Calculate pending marker number (next number after existing annotations)
  const pendingMarkerNumber = annotations.length + 1;

  return (
    <>
      <MarkerLayer
        annotations={annotations}
        isEntranceComplete={isEntranceComplete}
        onMarkerClick={annotationSelected}
        isDragging={isDragging}
        draggedAnnotationId={draggedAnnotationId}
        currentDragPosition={currentDragPosition}
        getMarkerDragHandlers={getMarkerHandlers}
      />
      <PendingMarker
        pendingAnnotation={pendingAnnotation}
        markerNumber={pendingMarkerNumber}
      />
      <DragHighlight
        annotation={draggedAnnotation}
        visible={isDragging}
      />
    </>
  );
}
