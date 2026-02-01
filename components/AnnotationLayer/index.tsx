import {useCallback, useMemo} from 'react';
import {MarkerLayer} from './MarkerLayer';
import {PendingMarker} from './PendingMarker';
import {DragHighlight} from './DragHighlight';
import {MarkerDragProvider} from './MarkerDragContext';
import {useAnnotationsStore} from '@/stores/annotations';
import {
  useToolbarActions,
  useToolbarState,
} from '@/components/FeedbackToolbar/ToolbarStateProvider';
import {useMarkerDrag} from '@/hooks/useMarkerDrag';
import type {Position} from '@/types/position';

export function AnnotationLayer() {
  const annotations = useAnnotationsStore(s => s.annotations);
  const annotationUpdated = useAnnotationsStore(s => s.annotationUpdated);
  const {
    pendingAnnotation,
    isEntranceComplete,
    selectedAnnotationId,
    selectedCategory,
  } = useToolbarState();
  const {annotationSelected} = useToolbarActions();

  const isDragDisabled = selectedAnnotationId !== null;

  const handleDragEnd = useCallback(
    (annotationId: string, position: Position) => {
      annotationUpdated(annotationId, {x: position.x, y: position.y});
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

  const dragContextValue = useMemo(
    () => ({
      isDragging,
      draggedAnnotationId,
      currentDragPosition,
      getMarkerDragHandlers: getMarkerHandlers,
    }),
    [isDragging, draggedAnnotationId, currentDragPosition, getMarkerHandlers]
  );

  const pendingMarkerNumber = annotations.length + 1;

  return (
    <>
      <MarkerDragProvider value={dragContextValue}>
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={isEntranceComplete}
          onMarkerClick={annotationSelected}
        />
      </MarkerDragProvider>
      <PendingMarker
        pendingAnnotation={pendingAnnotation}
        markerNumber={pendingMarkerNumber}
        category={selectedCategory}
      />
      <DragHighlight annotation={draggedAnnotation} visible={isDragging} />
    </>
  );
}
