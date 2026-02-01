import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { Annotation } from '@/types';
import type { Position } from '@/types/position';

const DRAG_THRESHOLD = 5;

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


  const mouseUpImplRef = useRef<(() => void) | null>(null);


  const handlePostDragClickCapture = useCallback((e: MouseEvent) => {
    if (dragSessionRef.current?.hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);


  const handleDragMouseUpStable = useCallback(() => {
    mouseUpImplRef.current?.();
  }, []);

  const handleDragMouseMove = useCallback((e: MouseEvent) => {
    if (!dragSessionRef.current) return;

    const { startX, startY, startPositionX, startPositionY, hasDragged, annotation } =
      dragSessionRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;


    if (!hasDragged) {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance < DRAG_THRESHOLD) {
        return;
      }

      dragSessionRef.current.hasDragged = true;
      setIsDragging(true);
      setDraggedAnnotation(annotation);


      e.preventDefault();
    }


    e.preventDefault();




    const newX = startPositionX + deltaX;
    const newY = startPositionY + deltaY;

    setCurrentDragPosition({ x: newX, y: newY });
  }, []);


  const handleDragMouseUpImpl = useCallback(() => {
    const session = dragSessionRef.current;
    const wasDragging = session?.hasDragged ?? false;

    setIsDragging(false);


    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUpStable);


    if (session) {
      if (wasDragging && onDragEnd && currentDragPosition) {
        onDragEnd(session.annotation.id, currentDragPosition);
      } else if (!wasDragging && onClick) {
        onClick(session.annotation.id);
      }
    }


    setDraggedAnnotation(null);
    setCurrentDragPosition(null);


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


  useEffect(() => {
    mouseUpImplRef.current = handleDragMouseUpImpl;
  }, [handleDragMouseUpImpl]);


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

        if (e.button !== 0) return;


        if (disabled) return;


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


        window.addEventListener('mousemove', handleDragMouseMove);
        window.addEventListener('mouseup', handleDragMouseUpStable);

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
