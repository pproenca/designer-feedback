import React, {useState, useCallback, useEffect, useMemo} from 'react';
import type {Position} from '@/types/position';
import {useDragSession} from './useDragSession';

export type ExpandDirection = 'left' | 'right';

export interface UseDraggableOptions {
  readonly enabled?: boolean;
  readonly elementWidth?: number;
  readonly elementHeight?: number;
  readonly initialPosition?: Position | null;
  readonly onPositionChange?: (position: Position) => void;
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
    enabled = true,
    elementWidth = 0,
    elementHeight = 0,
    initialPosition,
    onPositionChange,
  } = options;

  const [position, setPosition] = useState<Position | null>(
    initialPosition ?? null
  );

  useEffect(() => {
    if (initialPosition) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from prop
      setPosition(initialPosition);
    }
  }, [initialPosition]);

  const expandDirection: ExpandDirection = useMemo(() => {
    if (!position) {
      return 'left';
    }
    const viewportCenter = window.innerWidth / 2;
    const elementCenter = position.x + elementWidth / 2;
    return elementCenter > viewportCenter ? 'left' : 'right';
  }, [position, elementWidth]);

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

  const {isDragging, startDrag} = useDragSession({
    onDragMove(rawPosition) {
      const clamped = clampPosition(rawPosition.x, rawPosition.y);
      setPosition(clamped);
    },
    onDragEnd(wasDragged) {
      if (wasDragged && onPositionChange) {
        setPosition(currentPosition => {
          if (currentPosition) {
            onPositionChange(currentPosition);
          }
          return currentPosition;
        });
      }
    },
  });

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) {
        return;
      }

      startDrag(e, {
        x: position?.x ?? e.clientX,
        y: position?.y ?? e.clientY,
      });
    },
    [enabled, position, startDrag]
  );

  const reset = useCallback(() => {
    setPosition(null);
  }, []);

  return {
    position,
    isDragging,
    expandDirection,
    onMouseDown,
    reset,
  };
}
