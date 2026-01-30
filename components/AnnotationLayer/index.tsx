/**
 * AnnotationLayer - Container for rendering annotation markers
 *
 * This component composes MarkerLayer and PendingMarker to render
 * all annotation markers on the page.
 */

import { MarkerLayer } from './MarkerLayer';
import { PendingMarker } from './PendingMarker';
import { useAnnotationsStore } from '@/stores/annotations';
import { useToolbarActions, useToolbarState } from '@/components/FeedbackToolbar/ToolbarStateProvider';

// =============================================================================
// Component
// =============================================================================

export function AnnotationLayer() {
  const annotations = useAnnotationsStore((s) => s.annotations);
  const { pendingAnnotation, isEntranceComplete } = useToolbarState();
  const { annotationSelected } = useToolbarActions();

  // Calculate pending marker number (next number after existing annotations)
  const pendingMarkerNumber = annotations.length + 1;

  return (
    <>
      <MarkerLayer
        annotations={annotations}
        isEntranceComplete={isEntranceComplete}
        onMarkerClick={annotationSelected}
      />
      <PendingMarker
        pendingAnnotation={pendingAnnotation}
        markerNumber={pendingMarkerNumber}
      />
    </>
  );
}
