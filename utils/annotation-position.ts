const DEFAULT_POPUP_GAP = 16;

const DEFAULT_MARKER_POPUP_OFFSET = 24;

export interface PositionContext {
  rect: DOMRect;
  scrollX: number;
  scrollY: number;
  isFixed: boolean;
}

export interface MarkerPosition {
  x: number;
  y: number;
  isFixed: boolean;
}

export interface PopupPosition {
  x: number;
  y: number;
  isFixed: boolean;
}

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

export function calculateMarkerPosition(ctx: PositionContext): MarkerPosition {
  const {rect, scrollX, scrollY, isFixed} = ctx;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  if (isFixed) {
    return {
      x: centerX,
      y: centerY,
      isFixed: true,
    };
  }

  return {
    x: centerX + scrollX,
    y: centerY + scrollY,
    isFixed: false,
  };
}

export function calculatePopupPosition(
  ctx: PositionContext,
  gap: number = DEFAULT_POPUP_GAP
): PopupPosition {
  const {rect, scrollX, scrollY, isFixed} = ctx;

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

export function getMarkerDisplayPosition(
  annotation: AnnotationPositionData
): MarkerPosition {
  return {
    x: annotation.x,
    y: annotation.y,
    isFixed: annotation.isFixed ?? false,
  };
}

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
