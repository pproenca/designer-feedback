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
    if (initialPosition) {
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

  // Track if we just finished a drag - used to prevent clicks
  const hasJustDraggedRef = useRef(false);

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

  const handleDragMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragSessionRef.current) return;

      const { startX, startY, startPositionX, startPositionY, hasDragged } =
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

        // Prevent text selection during drag
        e.preventDefault();
      }

      // Prevent default on all moves during active drag
      e.preventDefault();

      const newX = startPositionX + deltaX;
      const newY = startPositionY + deltaY;
      const clamped = clampPosition(newX, newY);
      setPosition(clamped);
    },
    [clampPosition]
  );

  // Click handler to prevent clicks after drag
  const handlePostDragClickCapture = useCallback((e: MouseEvent) => {
    // If we just finished dragging, prevent the click from firing on buttons
    // This runs in capture phase before the button's click handler
    if (hasJustDraggedRef.current || dragSessionRef.current?.hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleDragMouseUp = useCallback(() => {
    const wasDragging = dragSessionRef.current?.hasDragged ?? false;

    setIsDragging(false);

    // Remove listeners
    window.removeEventListener('mousemove', handleDragMouseMove);
    window.removeEventListener('mouseup', handleDragMouseUp);

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
      hasJustDraggedRef.current = true;
    }

    // Clear drag state and flag after a frame to ensure click events are caught
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
  }, [onPositionChange, handleDragMouseMove, handlePostDragClickCapture]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        if (dragCleanupTimerRef.current !== null) {
          window.clearTimeout(dragCleanupTimerRef.current);
          dragCleanupTimerRef.current = null;
        }
        window.removeEventListener('mousemove', handleDragMouseMove);
        window.removeEventListener('mouseup', handleDragMouseUp);
        window.removeEventListener('click', handlePostDragClickCapture, true);
      }
    };
  }, [handleDragMouseMove, handleDragMouseUp, handlePostDragClickCapture]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;

      // Get current position or default to element's current rendered position
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

      // Add listeners
      window.addEventListener('mousemove', handleDragMouseMove);
      window.addEventListener('mouseup', handleDragMouseUp);
      // Capture click events to prevent them after drag
      window.addEventListener('click', handlePostDragClickCapture, true);
    },
    [position, handleDragMouseMove, handleDragMouseUp, handlePostDragClickCapture]
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
