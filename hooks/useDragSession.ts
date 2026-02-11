import {useCallback, useEffect, useRef, useState} from 'react';
import type {Position} from '@/types/position';

const DRAG_THRESHOLD = 5;

interface DragSessionState {
  readonly startX: number;
  readonly startY: number;
  readonly startPositionX: number;
  readonly startPositionY: number;
  hasDragged: boolean;
}

export interface DragSessionCallbacks {
  onDragStart?: () => void;
  onDragMove: (position: Position) => void;
  onDragEnd: (wasDragged: boolean) => void;
}

export interface UseDragSessionReturn {
  isDragging: boolean;
  startDrag: (e: React.MouseEvent, initialPosition: Position) => void;
}

export function useDragSession(
  callbacks: DragSessionCallbacks
): UseDragSessionReturn {
  const [isDragging, setIsDragging] = useState(false);

  const dragSessionRef = useRef<DragSessionState | null>(null);

  const dragCleanupTimerRef = useRef<number | null>(null);
  const hasJustDraggedRef = useRef(false);
  const mouseUpImplRef = useRef<(() => void) | null>(null);
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const handlePostDragClickCapture = useCallback((e: MouseEvent) => {
    if (hasJustDraggedRef.current || dragSessionRef.current?.hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleDragMouseUpStable = useCallback(() => {
    mouseUpImplRef.current?.();
  }, []);

  const handleDragMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragSessionRef.current) return;

      const {startX, startY, startPositionX, startPositionY, hasDragged} =
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
        callbacksRef.current.onDragStart?.();

        e.preventDefault();
      }

      e.preventDefault();

      callbacksRef.current.onDragMove({
        x: startPositionX + deltaX,
        y: startPositionY + deltaY,
      });
    },

    []
  );

  const handleDragMouseUpImpl = useCallback(() => {
    const wasDragging = dragSessionRef.current?.hasDragged ?? false;

    setIsDragging(false);

    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUpStable);

    callbacksRef.current.onDragEnd(wasDragging);

    if (wasDragging) {
      hasJustDraggedRef.current = true;
    }

    if (dragCleanupTimerRef.current !== null) {
      window.clearTimeout(dragCleanupTimerRef.current);
    }
    dragCleanupTimerRef.current = window.setTimeout(() => {
      dragSessionRef.current = null;
      hasJustDraggedRef.current = false;
      window.removeEventListener('click', handlePostDragClickCapture, true);
    }, 16);
  }, [
    handleDragMouseMove,
    handleDragMouseUpStable,
    handlePostDragClickCapture,
  ]);

  useEffect(() => {
    mouseUpImplRef.current = handleDragMouseUpImpl;
  }, [handleDragMouseUpImpl]);

  useEffect(() => {
    return () => {
      if (dragCleanupTimerRef.current !== null) {
        window.clearTimeout(dragCleanupTimerRef.current);
        dragCleanupTimerRef.current = null;
      }
      window.removeEventListener('mousemove', handleDragMouseMove);
      window.removeEventListener('mouseup', handleDragMouseUpStable);
      window.removeEventListener('click', handlePostDragClickCapture, true);
    };
  }, [
    handleDragMouseMove,
    handleDragMouseUpStable,
    handlePostDragClickCapture,
  ]);

  const startDrag = useCallback(
    (e: React.MouseEvent, initialPosition: Position) => {
      if (e.button !== 0) return;

      dragSessionRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPositionX: initialPosition.x,
        startPositionY: initialPosition.y,
        hasDragged: false,
      };

      window.addEventListener('mousemove', handleDragMouseMove);
      window.addEventListener('mouseup', handleDragMouseUpStable);
      window.addEventListener('click', handlePostDragClickCapture, true);
    },
    [handleDragMouseMove, handleDragMouseUpStable, handlePostDragClickCapture]
  );

  return {isDragging, startDrag};
}
