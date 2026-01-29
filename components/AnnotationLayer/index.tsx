/**
 * AnnotationLayer - Container for rendering annotation markers
 *
 * This component composes MarkerLayer and PendingMarker to render
 * all annotation markers on the page.
 */

import { MarkerLayer } from './MarkerLayer';
import { PendingMarker } from './PendingMarker';
import type { Annotation } from '@/types';
import type { PendingAnnotation } from '@/components/FeedbackToolbar/context';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationLayerProps {
  /** Saved annotations to display */
  annotations: Annotation[];
  /** Pending annotation being created */
  pendingAnnotation: PendingAnnotation | null;
  /** Whether entrance animation is complete */
  isEntranceComplete: boolean;
  /** Callback when a marker is clicked */
  onMarkerClick: (id: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function AnnotationLayer({
  annotations,
  pendingAnnotation,
  isEntranceComplete,
  onMarkerClick,
}: AnnotationLayerProps) {
  // Calculate pending marker number (next number after existing annotations)
  const pendingMarkerNumber = annotations.length + 1;

  return (
    <>
      <MarkerLayer
        annotations={annotations}
        isEntranceComplete={isEntranceComplete}
        onMarkerClick={onMarkerClick}
      />
      <PendingMarker
        pendingAnnotation={pendingAnnotation}
        markerNumber={pendingMarkerNumber}
      />
    </>
  );
}
