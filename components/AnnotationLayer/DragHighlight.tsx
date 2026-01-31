/**
 * DragHighlight - Visual highlight for the element being dragged
 *
 * Shows a semi-transparent outline at the annotation's boundingBox position
 * when a marker is being dragged. Uses fixed position for fixed markers,
 * absolute for others.
 */

import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import type { Annotation } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface DragHighlightProps {
  /** The annotation being dragged, null if not dragging */
  annotation: Annotation | null;
  /** Whether to show the highlight */
  visible: boolean;
}

// =============================================================================
// Animation Variants
// =============================================================================

const getVariants = (reduceMotion: boolean) => ({
  hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.98 }) },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : { scale: 1 }),
    transition: { duration: 0.12, ease: 'easeOut' as const },
  },
});

// =============================================================================
// Component
// =============================================================================

export function DragHighlight({ annotation, visible }: DragHighlightProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);

  // Don't render if not visible or no annotation
  const shouldRender = visible && annotation && annotation.boundingBox;

  return (
    <AnimatePresence>
      {shouldRender && annotation.boundingBox ? (
        <m.div
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={variants}
          className={clsx(
            'border-2 border-dashed border-df-blue/60 rounded bg-df-blue/8',
            'pointer-events-none box-border z-overlay',
            annotation.isFixed ? 'fixed' : 'absolute'
          )}
          style={{
            left: `${annotation.boundingBox.x}px`,
            top: `${annotation.boundingBox.y}px`,
            width: `${annotation.boundingBox.width}px`,
            height: `${annotation.boundingBox.height}px`,
          }}
          data-drag-highlight
        />
      ) : null}
    </AnimatePresence>
  );
}
