/**
 * PendingMarker - Temporary marker shown during annotation creation
 *
 * This component renders the marker that appears after clicking
 * an element but before the annotation is submitted.
 */

import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import type { PendingAnnotation } from '@/components/FeedbackToolbar/context';

// =============================================================================
// Types
// =============================================================================

export interface PendingMarkerProps {
  /** The pending annotation data, or null if none */
  pendingAnnotation: PendingAnnotation | null;
  /** The marker number to display */
  markerNumber: number;
}

// =============================================================================
// Animation Variants
// =============================================================================

const getVariants = (reduceMotion: boolean) => ({
  marker: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.9 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: reduceMotion
        ? { duration: 0.12, ease: 'easeOut' as const }
        : { type: 'spring' as const, stiffness: 400, damping: 20 },
    },
  },
});

// =============================================================================
// Component
// =============================================================================

export function PendingMarker({ pendingAnnotation, markerNumber }: PendingMarkerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);

  if (!pendingAnnotation) {
    return null;
  }

  const { x, y, rect, isFixed } = pendingAnnotation;

  // Calculate display position
  // For fixed elements, use rect-relative position
  // For absolute elements, use stored coordinates
  const displayY = isFixed ? rect.top + rect.height / 2 : y;

  return (
    <AnimatePresence>
      <m.div
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={variants.marker}
        className={clsx(
          'w-5.5 h-5.5 rounded-full flex items-center justify-center',
          'text-xs font-semibold text-white select-none',
          'shadow-marker -translate-x-1/2 -translate-y-1/2 bg-df-blue'
        )}
        style={{
          left: `${x}px`,
          top: `${displayY}px`,
          position: isFixed ? 'fixed' : 'absolute',
        }}
        data-pending-marker
      >
        {markerNumber}
      </m.div>
    </AnimatePresence>
  );
}
