/**
 * MarkerLayer - Renders annotation markers on the page
 *
 * This component handles:
 * - Rendering markers for both fixed and absolute positioned annotations
 * - Separating markers into fixed and absolute containers
 * - Click and keyboard interactions
 * - Hover tooltips
 */

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useMemo } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import { getCategoryConfig } from '@/shared/categories';
import type { Annotation } from '@/types';
import type { Position } from '@/hooks/useMarkerDrag';

// =============================================================================
// Types
// =============================================================================

export interface MarkerLayerProps {
  /** Array of annotations to render */
  annotations: Annotation[];
  /** Whether entrance animation is complete */
  isEntranceComplete: boolean;
  /** Callback when a marker is clicked */
  onMarkerClick: (id: string) => void;
  /** Whether dragging is currently in progress */
  isDragging?: boolean;
  /** ID of the annotation currently being dragged */
  draggedAnnotationId?: string | null;
  /** Current position during drag */
  currentDragPosition?: Position | null;
  /** Get drag handlers for a marker */
  getMarkerDragHandlers?: (annotation: Annotation) => { onMouseDown: (e: ReactMouseEvent) => void };
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
    hover: {
      ...(reduceMotion ? {} : { scale: 1.08 }),
      transition: { duration: 0.1, ease: 'easeOut' as const },
    },
  },
  tooltip: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: 2 }) },
    visible: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: 2 }) },
    hover: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1, y: 0 }),
      transition: { duration: 0.1, ease: 'easeOut' as const },
    },
  },
});

// =============================================================================
// Helper Component - Marker Tooltip
// =============================================================================

interface MarkerTooltipProps {
  annotation: Annotation;
  variants: ReturnType<typeof getVariants>['tooltip'];
}

function MarkerTooltip({ annotation, variants }: MarkerTooltipProps) {
  const config = getCategoryConfig(annotation.category);

  return (
    <m.div
      variants={variants}
      className={clsx(
        'absolute top-full mt-2.5 left-1/2 -translate-x-1/2 z-tooltip',
        'px-3 py-2 rounded-xl min-w-30 max-w-50 pointer-events-none cursor-default',
        'bg-white shadow-popup-light',
        'dark:bg-df-dark-ink dark:shadow-popup'
      )}
    >
      <span className={clsx('inline-flex items-center gap-1 text-xs font-semibold mb-1', config.tw.text)}>
        <config.Icon size={14} aria-hidden="true" />
        {config.label}
      </span>
      <span
        className={clsx(
          'block text-sm font-normal leading-tight whitespace-nowrap overflow-hidden text-ellipsis pb-0.5',
          'text-black/85 dark:text-white'
        )}
      >
        {annotation.comment}
      </span>
      <span
        className={clsx(
          'block text-2xs font-normal mt-1.5 whitespace-nowrap',
          'text-black/35 dark:text-white/60'
        )}
      >
        Click to view
      </span>
    </m.div>
  );
}

// =============================================================================
// Helper Component - Single Marker
// =============================================================================

interface MarkerProps {
  annotation: Annotation;
  index: number;
  isEntranceComplete: boolean;
  onMarkerClick: (id: string) => void;
  variants: ReturnType<typeof getVariants>;
  /** Whether this marker is being dragged */
  isDragged?: boolean;
  /** Override position during drag */
  dragPosition?: Position | null;
  /** Drag mousedown handler */
  onDragMouseDown?: (e: ReactMouseEvent) => void;
}

function Marker({
  annotation,
  index,
  isEntranceComplete,
  onMarkerClick,
  variants,
  isDragged = false,
  dragPosition,
  onDragMouseDown,
}: MarkerProps) {
  const config = getCategoryConfig(annotation.category);

  const handleClick = () => {
    // Don't trigger click handler if we have drag handlers (drag handles its own click)
    if (!onDragMouseDown) {
      onMarkerClick(annotation.id);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onMarkerClick(annotation.id);
    }
  };

  // Use drag position if being dragged, otherwise use annotation position
  const displayX = isDragged && dragPosition ? dragPosition.x : annotation.x;
  const displayY = isDragged && dragPosition ? dragPosition.y : annotation.y;

  return (
    <m.div
      initial={!isEntranceComplete ? 'hidden' : false}
      animate="visible"
      whileHover={isDragged ? undefined : 'hover'}
      variants={variants.marker}
      className={clsx(
        'w-5.5 h-5.5 rounded-full flex items-center justify-center',
        'text-xs font-semibold text-white select-none',
        'shadow-marker -translate-x-1/2 -translate-y-1/2 z-10',
        'hover:z-20',
        annotation.isFixed ? 'fixed' : 'absolute',
        config.tw.bg,
        isDragged ? 'cursor-grabbing z-30' : 'cursor-grab'
      )}
      style={{
        left: `${displayX}px`,
        top: `${displayY}px`,
      }}
      data-annotation-marker
      onClick={handleClick}
      onMouseDown={onDragMouseDown}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Annotation ${index + 1} (${config.label})`}
    >
      {index + 1}
      {!isDragged && <MarkerTooltip annotation={annotation} variants={variants.tooltip} />}
    </m.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function MarkerLayer({
  annotations,
  isEntranceComplete,
  onMarkerClick,
  isDragging = false,
  draggedAnnotationId,
  currentDragPosition,
  getMarkerDragHandlers,
}: MarkerLayerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);

  // Separate annotations into fixed and absolute
  const { absoluteMarkers, fixedMarkers } = useMemo(() => {
    const absolute: Array<{ annotation: Annotation; globalIndex: number }> = [];
    const fixed: Array<{ annotation: Annotation; globalIndex: number }> = [];

    annotations.forEach((annotation, index) => {
      if (annotation.isFixed) {
        fixed.push({ annotation, globalIndex: index });
      } else {
        absolute.push({ annotation, globalIndex: index });
      }
    });

    return { absoluteMarkers: absolute, fixedMarkers: fixed };
  }, [annotations]);

  if (annotations.length === 0) {
    return null;
  }

  const renderMarker = (annotation: Annotation, globalIndex: number) => {
    const isThisMarkerDragged = isDragging && draggedAnnotationId === annotation.id;
    const dragHandlers = getMarkerDragHandlers?.(annotation);

    return (
      <Marker
        key={annotation.id || `annotation-${globalIndex}`}
        annotation={annotation}
        index={globalIndex}
        isEntranceComplete={isEntranceComplete}
        onMarkerClick={onMarkerClick}
        variants={variants}
        isDragged={isThisMarkerDragged}
        dragPosition={isThisMarkerDragged ? currentDragPosition : null}
        onDragMouseDown={dragHandlers?.onMouseDown}
      />
    );
  };

  return (
    <>
      {/* Absolute positioned markers container */}
      <div className="absolute top-0 left-0 right-0 h-0 z-markers pointer-events-none [&>*]:pointer-events-auto">
        {absoluteMarkers.map(({ annotation, globalIndex }) => renderMarker(annotation, globalIndex))}
      </div>

      {/* Fixed positioned markers container */}
      <div className="fixed inset-0 z-markers pointer-events-none [&>*]:pointer-events-auto">
        {fixedMarkers.map(({ annotation, globalIndex }) => renderMarker(annotation, globalIndex))}
      </div>
    </>
  );
}
