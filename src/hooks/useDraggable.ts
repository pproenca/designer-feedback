import React, { useState, useCallback, useEffect, useRef } from 'react';

const DRAG_THRESHOLD = 5;

export interface Position {
  x: number;
  y: number;
}

export interface UseDraggableOptions {
  elementWidth?: number;
  elementHeight?: number;
}

export interface UseDraggableReturn {
  position: Position | null;
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  reset: () => void;
}

export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
  const { elementWidth = 0, elementHeight = 0 } = options;

  const [position, setPosition] = useState<Position | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    hasMoved: boolean;
  } | null>(null);

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

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragStateRef.current) return;

      const { startX, startY, startPosX, startPosY, hasMoved } = dragStateRef.current;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Check threshold before starting drag
      if (!hasMoved) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance < DRAG_THRESHOLD) {
          return;
        }
        dragStateRef.current.hasMoved = true;
        setIsDragging(true);
      }

      const newX = startPosX + deltaX;
      const newY = startPosY + deltaY;
      const clamped = clampPosition(newX, newY);
      setPosition(clamped);
    },
    [clampPosition]
  );

  const handleMouseUp = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
  }, []);

  // Set up global listeners when drag starts
  useEffect(() => {
    if (dragStateRef.current) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [handleMouseMove, handleMouseUp]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    // Get current position or default to element's position
    const currentX = position?.x ?? e.clientX;
    const currentY = position?.y ?? e.clientY;

    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: currentX,
      startPosY: currentY,
      hasMoved: false,
    };

    // Add listeners immediately
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [position, handleMouseMove, handleMouseUp]);

  const reset = useCallback(() => {
    setPosition(null);
    setIsDragging(false);
    dragStateRef.current = null;
  }, []);

  return {
    position,
    isDragging,
    onMouseDown,
    reset,
  };
}
