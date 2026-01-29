/**
 * Position calculation utilities for annotation markers and popups.
 *
 * These utilities provide consistent coordinate calculations for:
 * - Markers (placed at element center)
 * - Popups (positioned below element with gap)
 *
 * The key distinction is between:
 * - Fixed elements: Use viewport-relative coordinates (ignore scroll)
 * - Absolute elements: Use document-relative coordinates (include scroll)
 */

/** Default gap between element and popup in pixels */
const DEFAULT_POPUP_GAP = 16;

/** Default offset from marker center to popup */
const DEFAULT_MARKER_POPUP_OFFSET = 24;

/** Context needed to calculate positions */
export interface PositionContext {
  rect: DOMRect;
  scrollX: number;
  scrollY: number;
  isFixed: boolean;
}

/** Result of marker position calculation */
export interface MarkerPosition {
  x: number;
  y: number;
  isFixed: boolean;
}

/** Result of popup position calculation */
export interface PopupPosition {
  x: number;
  y: number;
  isFixed: boolean;
}

/** Minimal annotation data needed for position display */
export interface AnnotationPositionData {
  x: number;
  y: number;
  isFixed?: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Calculate the position where a marker should be placed.
 *
 * For fixed elements: Returns viewport-relative coordinates (ignores scroll)
 * For absolute elements: Returns document-relative coordinates (includes scroll)
 *
 * The marker is centered on the element.
 */
export function calculateMarkerPosition(ctx: PositionContext): MarkerPosition {
  const { rect, scrollX, scrollY, isFixed } = ctx;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  if (isFixed) {
    // Fixed elements: viewport-relative coordinates
    return {
      x: centerX,
      y: centerY,
      isFixed: true,
    };
  }

  // Absolute elements: document-relative coordinates (add scroll)
  return {
    x: centerX + scrollX,
    y: centerY + scrollY,
    isFixed: false,
  };
}

/**
 * Calculate the position where a popup should appear.
 *
 * The popup is positioned below the element (using rect.bottom),
 * horizontally centered on the element.
 *
 * For fixed elements: Returns viewport-relative coordinates
 * For absolute elements: Returns document-relative coordinates
 */
export function calculatePopupPosition(
  ctx: PositionContext,
  gap: number = DEFAULT_POPUP_GAP
): PopupPosition {
  const { rect, scrollX, scrollY, isFixed } = ctx;

  const centerX = rect.left + rect.width / 2;
  const belowY = rect.bottom + gap;

  if (isFixed) {
    return {
      x: centerX,
      y: belowY,
      isFixed: true,
    };
  }

  return {
    x: centerX + scrollX,
    y: belowY + scrollY,
    isFixed: false,
  };
}

/**
 * Get the display position for a marker from stored annotation data.
 *
 * This simply returns the stored coordinates which are already
 * in the correct coordinate system (viewport for fixed, document for absolute).
 */
export function getMarkerDisplayPosition(
  annotation: AnnotationPositionData
): MarkerPosition {
  return {
    x: annotation.x,
    y: annotation.y,
    isFixed: annotation.isFixed ?? false,
  };
}

/**
 * Get the display position for a popup from stored annotation data.
 *
 * Positions the popup below the marker with a configurable gap.
 * The popup is horizontally aligned with the marker.
 */
export function getPopupDisplayPosition(
  annotation: AnnotationPositionData,
  gap: number = DEFAULT_MARKER_POPUP_OFFSET
): PopupPosition {
  return {
    x: annotation.x,
    y: annotation.y + gap,
    isFixed: annotation.isFixed ?? false,
  };
}
