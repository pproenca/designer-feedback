import type { ReactNode } from 'react';

interface SVGIconProps {
  /** Icon size in pixels */
  size?: number;
  /** SVG viewBox (defaults to "0 0 24 24") */
  viewBox?: string;
  /** SVG children (paths, circles, etc.) */
  children: ReactNode;
}

/**
 * Base SVG wrapper component for consistent icon rendering.
 * Removes repetitive viewBox, fill, and aria-hidden attributes from icon definitions.
 */
export function SVGIcon({ size = 16, viewBox = '0 0 24 24', children }: SVGIconProps) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}
