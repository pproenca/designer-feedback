/**
 * useMarkerDrag - Hook for dragging annotation markers
 *
 * Adapted from useDraggable.ts but tailored for markers:
 * - No viewport clamping (markers can be anywhere on page)
 * - Handles both fixed and absolute coordinate systems
 * - Distinguishes click vs drag with 5px threshold
 * - Exposes draggedAnnotation for highlight coordination
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Annotation } from '@/types';

const DRAG_THRESHOLD = 5;

// =============================================================================
// Types
// =============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface UseMarkerDragOptions {
  /** Callback when marker is clicked (not dragged) */
  onClick?: (annotationId: string) => void;
  /** Callback when drag ends with new position */
  onDragEnd?: (annotationId: string, position: Position) => void;
  /** Disable drag functionality */
  disabled?: boolean;
}

export interface MarkerHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
}

export interface UseMarkerDragReturn {
  /** Whether a drag is in progress */
  isDragging: boolean;
  /** ID of the annotation being dragged, null if not dragging */
  draggedAnnotationId: string | null;
  /** The full annotation being dragged, null if not dragging */
  draggedAnnotation: Annotation | null;
  /** Current position during drag, null if not dragging */
  currentDragPosition: Position | null;
  /** Get handlers to attach to a marker */
  getMarkerHandlers: (annotation: Annotation) => MarkerHandlers;
}

// =============================================================================
// Hook
// =============================================================================

export function useMarkerDrag(options: UseMarkerDragOptions = {}): UseMarkerDragReturn {
  const { onClick, onDragEnd, disabled = false } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [draggedAnnotation, setDraggedAnnotation] = useState<Annotation | null>(null);
  const [currentDragPosition, setCurrentDragPosition] = useState<Position | null>(null);

  const dragSessionRef = useRef<{
    startX: number;
    startY: number;
    startPositionX: number;
    startPositionY: number;
    hasDragged: boolean;
    annotation: Annotation;
  } | null>(null);

  const dragCleanupTimerRef = useRef<number | null>(null);

  // Ref to store latest mouseup implementation
  const mouseUpImplRef = useRef<(() => void) | null>(null);

  // Click handler to prevent clicks after drag
  const handlePostDragClickCapture = useCallback((e: MouseEvent) => {
    if (dragSessionRef.current?.hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // Stable callback that delegates to the ref
  const handleDragMouseUpStable = useCallback(() => {
    mouseUpImplRef.current?.();
  }, []);

  const handleDragMouseMove = useCallback((e: MouseEvent) => {
    if (!dragSessionRef.current) return;

    const { startX, startY, startPositionX, startPositionY, hasDragged, annotation } =
      dragSessionRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Check threshold before starting drag
    if (!hasDragged) {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }
      // Threshold exceeded - this is now a drag, not a click
      dragSessionRef.current.hasDragged = true;
      setIsDragging(true);
      setDraggedAnnotation(annotation);

      // Prevent text selection during drag
      e.preventDefault();
    }

    // Prevent default on all moves during active drag
    e.preventDefault();

    // Calculate new position
    // For both fixed and absolute, we use the same delta approach
    // The difference is in how the marker is rendered (fixed vs absolute CSS)
    const newX = startPositionX + deltaX;
    const newY = startPositionY + deltaY;

    setCurrentDragPosition({ x: newX, y: newY });
  }, []);

  // Implementation that does the actual work
  const handleDragMouseUpImpl = useCallback(() => {
    const session = dragSessionRef.current;
    const wasDragging = session?.hasDragged ?? false;

    setIsDragging(false);

    // Remove listeners
    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUpStable);

    // Handle callbacks
    if (session) {
      if (wasDragging && onDragEnd && currentDragPosition) {
        onDragEnd(session.annotation.id, currentDragPosition);
      } else if (!wasDragging && onClick) {
        onClick(session.annotation.id);
      }
    }

    // Clear drag state
    setDraggedAnnotation(null);
    setCurrentDragPosition(null);

    // Clear drag session and flag after a frame to ensure click events are caught
    if (dragCleanupTimerRef.current !== null) {
      window.clearTimeout(dragCleanupTimerRef.current);
    }
    dragCleanupTimerRef.current = window.setTimeout(() => {
      dragSessionRef.current = null;
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', handlePostDragClickCapture, true);
      }
    }, 16);
  }, [
    onClick,
    onDragEnd,
    currentDragPosition,
    handleDragMouseMove,
    handleDragMouseUpStable,
    handlePostDragClickCapture,
  ]);

  // Keep ref updated with latest implementation
  useEffect(() => {
    mouseUpImplRef.current = handleDragMouseUpImpl;
  }, [handleDragMouseUpImpl]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        if (dragCleanupTimerRef.current !== null) {
          window.clearTimeout(dragCleanupTimerRef.current);
          dragCleanupTimerRef.current = null;
        }
        window.removeEventListener('mousemove', handleDragMouseMove);
        window.removeEventListener('mouseup', handleDragMouseUpStable);
        window.removeEventListener('click', handlePostDragClickCapture, true);
      }
    };
  }, [handleDragMouseMove, handleDragMouseUpStable, handlePostDragClickCapture]);

  const getMarkerHandlers = useCallback(
    (annotation: Annotation): MarkerHandlers => {
      const onMouseDown = (e: React.MouseEvent) => {
        // Only handle left mouse button
        if (e.button !== 0) return;

        // Don't start drag if disabled
        if (disabled) return;

        // Use the annotation's current position as start
        const startPositionX = annotation.x;
        const startPositionY = annotation.y;

        dragSessionRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startPositionX,
          startPositionY,
          hasDragged: false,
          annotation,
        };

        // Add listeners
        window.addEventListener('mousemove', handleDragMouseMove);
        window.addEventListener('mouseup', handleDragMouseUpStable);
        // Capture click events to prevent them after drag
        window.addEventListener('click', handlePostDragClickCapture, true);
      };

      return { onMouseDown };
    },
    [disabled, handleDragMouseMove, handleDragMouseUpStable, handlePostDragClickCapture]
  );

  return {
    isDragging,
    draggedAnnotationId: draggedAnnotation?.id ?? null,
    draggedAnnotation,
    currentDragPosition,
    getMarkerHandlers,
  };
}
