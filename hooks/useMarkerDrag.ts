import React, {useState, useCallback, useRef} from 'react';
import type {Annotation} from '@/types';
import type {Position} from '@/types/position';
import {useDragSession} from './useDragSession';

export interface UseMarkerDragOptions {
  onClick?: (annotationId: string) => void;

  onDragEnd?: (annotationId: string, position: Position) => void;

  disabled?: boolean;
}

export interface MarkerHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
}

export interface UseMarkerDragReturn {
  isDragging: boolean;

  draggedAnnotationId: string | null;

  draggedAnnotation: Annotation | null;

  currentDragPosition: Position | null;

  getMarkerHandlers: (annotation: Annotation) => MarkerHandlers;
}

export function useMarkerDrag(
  options: UseMarkerDragOptions = {}
): UseMarkerDragReturn {
  const {onClick, onDragEnd, disabled = false} = options;

  const [draggedAnnotation, setDraggedAnnotation] = useState<Annotation | null>(
    null
  );
  const [currentDragPosition, setCurrentDragPosition] =
    useState<Position | null>(null);

  const activeAnnotationRef = useRef<Annotation | null>(null);
  const currentDragPositionRef = useRef<Position | null>(null);

  const clampToBounds = useCallback(
    (pos: Position, annotation: Annotation): Position => {
      const bounds = annotation.boundingBox;
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) return pos;

      const scrollX = annotation.isFixed ? window.scrollX : 0;
      const scrollY = annotation.isFixed ? window.scrollY : 0;
      const minX = bounds.x - scrollX;
      const minY = bounds.y - scrollY;
      const maxX = minX + bounds.width;
      const maxY = minY + bounds.height;

      return {
        x: Math.min(Math.max(pos.x, minX), maxX),
        y: Math.min(Math.max(pos.y, minY), maxY),
      };
    },
    []
  );

  const {isDragging, startDrag} = useDragSession({
    onDragStart() {
      setDraggedAnnotation(activeAnnotationRef.current);
    },
    onDragMove(rawPosition) {
      const annotation = activeAnnotationRef.current;
      if (!annotation) return;

      const clamped = clampToBounds(rawPosition, annotation);
      currentDragPositionRef.current = clamped;
      setCurrentDragPosition(clamped);
    },
    onDragEnd(wasDragged) {
      const annotation = activeAnnotationRef.current;
      const finalPosition = currentDragPositionRef.current;

      if (annotation) {
        if (wasDragged && onDragEnd && finalPosition) {
          onDragEnd(annotation.id, finalPosition);
        } else if (!wasDragged && onClick) {
          onClick(annotation.id);
        }
      }

      activeAnnotationRef.current = null;
      currentDragPositionRef.current = null;
      setDraggedAnnotation(null);
      setCurrentDragPosition(null);
    },
  });

  const getMarkerHandlers = useCallback(
    (annotation: Annotation): MarkerHandlers => {
      const onMouseDown = (e: React.MouseEvent) => {
        if (disabled) return;

        activeAnnotationRef.current = annotation;
        startDrag(e, {x: annotation.x, y: annotation.y});
      };

      return {onMouseDown};
    },
    [disabled, startDrag]
  );

  return {
    isDragging,
    draggedAnnotationId: draggedAnnotation?.id ?? null,
    draggedAnnotation,
    currentDragPosition,
    getMarkerHandlers,
  };
}
