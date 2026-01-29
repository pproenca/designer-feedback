/**
 * usePopupPosition - Hook for positioning annotation popups
 *
 * This hook provides:
 * - Viewport-aware positioning with clamping
 * - Support for both fixed and absolute positioned elements
 * - Automatic repositioning on window resize
 */

import { useState, useEffect, useMemo } from 'react';

// =============================================================================
// Constants (exported for testing)
// =============================================================================

/** Default popup width for clamping calculations */
export const POPUP_WIDTH = 320;

/** Default popup height for clamping calculations */
export const POPUP_HEIGHT = 200;

/** Padding from viewport edges */
export const POPUP_PADDING = 16;

// =============================================================================
// Types
// =============================================================================

export interface PopupPositionInput {
  /** Target x coordinate (center of element) */
  x: number;
  /** Target y coordinate (below element) */
  y: number;
  /** Whether the popup should use fixed positioning */
  isFixed: boolean;
}

export interface PopupPositionResult {
  /** Adjusted x coordinate */
  x: number;
  /** Adjusted y coordinate */
  y: number;
  /** Whether to use fixed positioning */
  isFixed: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function clampPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  const halfWidth = POPUP_WIDTH / 2;

  // Clamp X to keep popup within viewport
  const minX = halfWidth + POPUP_PADDING;
  const maxX = viewportWidth - halfWidth - POPUP_PADDING;
  const clampedX = Math.max(minX, Math.min(maxX, x));

  // Clamp Y to keep popup within viewport
  const minY = POPUP_PADDING;
  const maxY = viewportHeight - POPUP_HEIGHT - POPUP_PADDING;
  const clampedY = Math.max(minY, Math.min(maxY, y));

  return { x: clampedX, y: clampedY };
}

// =============================================================================
// Hook
// =============================================================================

export function usePopupPosition({
  x,
  y,
  isFixed,
}: PopupPositionInput): PopupPositionResult {
  // Track viewport size for resize updates
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Calculate clamped position based on current viewport
  const position = useMemo(
    () => clampPosition(x, y, viewportSize.width, viewportSize.height),
    [x, y, viewportSize.width, viewportSize.height]
  );

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    x: position.x,
    y: position.y,
    isFixed,
  };
}
