import {useState, useEffect, useMemo} from 'react';

export const POPUP_WIDTH = 320;

export const POPUP_HEIGHT = 200;

export const POPUP_PADDING = 16;

export interface PopupPositionInput {
  x: number;

  y: number;

  isFixed: boolean;
}

export interface PopupPositionResult {
  x: number;

  y: number;

  isFixed: boolean;
}

function clampPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number
): {x: number; y: number} {
  const halfWidth = POPUP_WIDTH / 2;

  const minX = halfWidth + POPUP_PADDING;
  const maxX = viewportWidth - halfWidth - POPUP_PADDING;
  const clampedX = Math.max(minX, Math.min(maxX, x));

  const minY = POPUP_PADDING;
  const maxY = viewportHeight - POPUP_HEIGHT - POPUP_PADDING;
  const clampedY = Math.max(minY, Math.min(maxY, y));

  return {x: clampedX, y: clampedY};
}

export function usePopupPosition({
  x,
  y,
  isFixed,
}: PopupPositionInput): PopupPositionResult {
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const position = useMemo(
    () => clampPosition(x, y, viewportSize.width, viewportSize.height),
    [x, y, viewportSize.width, viewportSize.height]
  );

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
