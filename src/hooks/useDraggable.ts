import React, { useState, useCallback, useEffect, useRef } from 'react';

const DRAG_THRESHOLD = 5;

export interface Position {
  x: number;
  y: number;
}

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

export function useDraggable(options: UseDraggableOptions = {}): UseDraggableReturn {
  const { elementWidth = 0, elementHeight = 0, initialPosition, onPositionChange } = options;

  const [position, setPosition] = useState<Position | null>(initialPosition ?? null);
  const [isDragging, setIsDragging] = useState(false);

  // Sync position with initialPosition when it changes (e.g., loaded from storage)
  useEffect(() => {
    if (initialPosition && !position) {
      setPosition(initialPosition);
    }
  }, [initialPosition, position]);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    hasMoved: boolean;
    target: EventTarget | null;
  } | null>(null);

  const cleanupTimerRef = useRef<number | null>(null);

  // Track if we just finished a drag - used to prevent clicks
  const justDraggedRef = useRef(false);

  // Calculate expand direction based on position
  // When position is null (initial state), default to 'left' (toolbar starts on right)
  // When position is on right side of viewport (> center), expand left
  // When position is on left side of viewport (< center), expand right
  const expandDirection: ExpandDirection = (() => {
    if (!position) {
      return 'left'; // Default: toolbar starts on right, expands left
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
      setPosition(clamped);
    }
  }, [position, clampPosition]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => (current ? clampPosition(current.x, current.y) : current));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

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
        // Threshold exceeded - this is now a drag, not a click
        dragStateRef.current.hasMoved = true;
        setIsDragging(true);

        // Prevent text selection during drag
        e.preventDefault();
      }

      // Prevent default on all moves during active drag
      e.preventDefault();

      const newX = startPosX + deltaX;
      const newY = startPosY + deltaY;
      const clamped = clampPosition(newX, newY);
      setPosition(clamped);
    },
    [clampPosition]
  );

  // Click handler to prevent clicks after drag
  const handleClick = useCallback((e: MouseEvent) => {
    // If we just finished dragging, prevent the click from firing on buttons
    // This runs in capture phase before the button's click handler
    if (justDraggedRef.current || dragStateRef.current?.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    const wasDragging = dragStateRef.current?.hasMoved ?? false;

    setIsDragging(false);

    // Remove listeners
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    // Call onPositionChange callback if drag actually happened
    if (wasDragging && onPositionChange) {
      setPosition((currentPosition) => {
        if (currentPosition) {
          onPositionChange(currentPosition);
        }
        return currentPosition;
      });
    }

    // Set flag to prevent click events that fire shortly after mouseup
    if (wasDragging) {
      justDraggedRef.current = true;
    }

    // Clear drag state and flag after a frame to ensure click events are caught
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
    }
    cleanupTimerRef.current = window.setTimeout(() => {
      dragStateRef.current = null;
      justDraggedRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('click', handleClick, true);
      }
    }, 16);
  }, [onPositionChange, handleMouseMove, handleClick]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        if (cleanupTimerRef.current !== null) {
          window.clearTimeout(cleanupTimerRef.current);
          cleanupTimerRef.current = null;
        }
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('click', handleClick, true);
      }
    };
  }, [handleMouseMove, handleMouseUp, handleClick]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;

      // Get current position or default to element's current rendered position
      const currentX = position?.x ?? e.clientX;
      const currentY = position?.y ?? e.clientY;

      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: currentX,
        startPosY: currentY,
        hasMoved: false,
        target: e.target,
      };

      // Add listeners
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      // Capture click events to prevent them after drag
      window.addEventListener('click', handleClick, true);
    },
    [position, handleMouseMove, handleMouseUp, handleClick]
  );

  const reset = useCallback(() => {
    setPosition(null);
    setIsDragging(false);
    dragStateRef.current = null;
  }, []);

  return {
    position,
    isDragging,
    expandDirection,
    onMouseDown,
    reset,
  };
}
