/**
 * AnnotationLayer - Container for rendering annotation markers
 *
 * This component composes MarkerLayer and PendingMarker to render
 * all annotation markers on the page.
 */

import { MarkerLayer } from './MarkerLayer';
import { PendingMarker } from './PendingMarker';
import { useToolbarStore } from '@/stores/toolbar';
import { useAnnotationsStore } from '@/stores/annotations';

// =============================================================================
// Component
// =============================================================================

export function AnnotationLayer() {
  const annotations = useAnnotationsStore((s) => s.annotations);
  const pendingAnnotation = useToolbarStore((s) => s.pendingAnnotation);
  const isEntranceComplete = useToolbarStore((s) => s.isEntranceComplete);
  const annotationSelected = useToolbarStore((s) => s.annotationSelected);

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
