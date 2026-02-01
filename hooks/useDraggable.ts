import React, {useState, useCallback, useEffect, useRef} from 'react';
import type {Position} from '@/types/position';

const DRAG_THRESHOLD = 5;

export type ExpandDirection = 'left' | 'right';

export interface UseDraggableOptions {
  elementWidth?: number;
  elementHeight?: number;
  initialPosition?: Position | null;
  onPositionChange?: (position: Position) => void;
}

export interface UseDraggableReturn {
  position: Position | null;
  isDragging: boolean;
  expandDirection: ExpandDirection;
  onMouseDown: (e: React.MouseEvent) => void;
  reset: () => void;
}

export function useDraggable(
  options: UseDraggableOptions = {}
): UseDraggableReturn {
  const {
    elementWidth = 0,
    elementHeight = 0,
    initialPosition,
    onPositionChange,
  } = options;

  const [position, setPosition] = useState<Position | null>(
    initialPosition ?? null
  );
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (initialPosition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from prop
      setPosition(initialPosition);
    }
  }, [initialPosition]);

  const dragSessionRef = useRef<{
    startX: number;
    startY: number;
    startPositionX: number;
    startPositionY: number;
    hasDragged: boolean;
    target: EventTarget | null;
  } | null>(null);

  const dragCleanupTimerRef = useRef<number | null>(null);

  const hasJustDraggedRef = useRef(false);

  const mouseUpImplRef = useRef<(() => void) | null>(null);

  const expandDirection: ExpandDirection = (() => {
    if (!position) {
      return 'left';
    }
    const viewportCenter = window.innerWidth / 2;
    const elementCenter = position.x + elementWidth / 2;
    return elementCenter > viewportCenter ? 'left' : 'right';
  })();

  const clampPosition = useCallback(
    (x: number, y: number): Position => {
      const maxX = window.innerWidth - elementWidth;
      const maxY = window.innerHeight - elementHeight;

      return {
        x: Math.max(0, Math.min(x, maxX)),
        y: Math.max(0, Math.min(y, maxY)),
      };
    },
    [elementWidth, elementHeight]
  );

  useEffect(() => {
    if (!position) return;
    const clamped = clampPosition(position.x, position.y);
    if (clamped.x !== position.x || clamped.y !== position.y) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp bounds
      setPosition(clamped);
    }
  }, [position, clampPosition]);

  useEffect(() => {
    const handleResize = () => {
      setPosition(current =>
        current ? clampPosition(current.x, current.y) : current
      );
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

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

        e.preventDefault();
      }

      e.preventDefault();

      const newX = startPositionX + deltaX;
      const newY = startPositionY + deltaY;
      const clamped = clampPosition(newX, newY);
      setPosition(clamped);
    },
    [clampPosition]
  );

  const handlePostDragClickCapture = useCallback((e: MouseEvent) => {
    if (hasJustDraggedRef.current || dragSessionRef.current?.hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleDragMouseUpStable = useCallback(() => {
    mouseUpImplRef.current?.();
  }, []);

  const handleDragMouseUpImpl = useCallback(() => {
    const wasDragging = dragSessionRef.current?.hasDragged ?? false;

    setIsDragging(false);

    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUpStable);

    if (wasDragging && onPositionChange) {
      setPosition(currentPosition => {
        if (currentPosition) {
          onPositionChange(currentPosition);
        }
        return currentPosition;
      });
    }

    if (wasDragging) {
      hasJustDraggedRef.current = true;
    }

    if (dragCleanupTimerRef.current !== null) {
      window.clearTimeout(dragCleanupTimerRef.current);
    }
    dragCleanupTimerRef.current = window.setTimeout(() => {
      dragSessionRef.current = null;
      hasJustDraggedRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', handlePostDragClickCapture, true);
      }
    }, 16);
  }, [
    onPositionChange,
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
  }, [
    handleDragMouseMove,
    handleDragMouseUpStable,
    handlePostDragClickCapture,
  ]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;

      const startPositionX = position?.x ?? e.clientX;
      const startPositionY = position?.y ?? e.clientY;

      dragSessionRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPositionX,
        startPositionY,
        hasDragged: false,
        target: e.target,
      };

      window.addEventListener('mousemove', handleDragMouseMove);
      window.addEventListener('mouseup', handleDragMouseUpStable);

      window.addEventListener('click', handlePostDragClickCapture, true);
    },
    [
      position,
      handleDragMouseMove,
      handleDragMouseUpStable,
      handlePostDragClickCapture,
    ]
  );

  const reset = useCallback(() => {
    setPosition(null);
    setIsDragging(false);
    dragSessionRef.current = null;
  }, []);

  return {
    position,
    isDragging,
    expandDirection,
    onMouseDown,
    reset,
  };
}
