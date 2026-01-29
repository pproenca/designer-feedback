/**
 * useElementSelection - Hook for element selection during annotation mode
 *
 * This hook provides:
 * - Element hover tracking with minimal re-renders
 * - RAF-batched position updates for motion values
 * - State updates only when element identity changes
 * - Proper cleanup on unmount
 *
 * Key optimizations:
 * - Uses refs for high-frequency updates (position)
 * - Uses useMotionValue for smooth visual updates without re-renders
 * - Only triggers state updates when element path changes
 * - RAF batching prevents rapid position calculations
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMotionValue, type MotionValue } from 'framer-motion';
import { identifyElement } from '@/utils/element-identification';

// =============================================================================
// Types
// =============================================================================

export interface HoverInfo {
  element: string;
}

export interface UseElementSelectionOptions {
  /** Whether element selection is enabled */
  enabled: boolean;
}

export interface UseElementSelectionResult {
  /** Current hover info (element name), null if not hovering */
  hoverInfo: HoverInfo | null;
  /** Whether there's currently a target element */
  hasTarget: boolean;
  /** Motion values for highlight box position */
  highlightX: MotionValue<number>;
  highlightY: MotionValue<number>;
  highlightWidth: MotionValue<number>;
  highlightHeight: MotionValue<number>;
  /** Motion values for tooltip position */
  tooltipX: MotionValue<number>;
  tooltipY: MotionValue<number>;
}

// =============================================================================
// Constants
// =============================================================================

/** Tooltip offset from element bottom */
const TOOLTIP_OFFSET = 8;

// =============================================================================
// Hook
// =============================================================================

export function useElementSelection({
  enabled,
}: UseElementSelectionOptions): UseElementSelectionResult {
  // State for element info (triggers re-render only when element changes)
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Motion values for smooth visual updates without re-renders
  const highlightX = useMotionValue(0);
  const highlightY = useMotionValue(0);
  const highlightWidth = useMotionValue(0);
  const highlightHeight = useMotionValue(0);
  const tooltipX = useMotionValue(0);
  const tooltipY = useMotionValue(0);

  // Refs for tracking without re-renders
  const elementPathRef = useRef<string | null>(null);
  const elementLabelRef = useRef<string | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const hoverInfoRef = useRef<HoverInfo | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Keep hoverInfoRef in sync
  useEffect(() => {
    hoverInfoRef.current = hoverInfo;
  }, [hoverInfo]);

  // Clear state when disabled
  useEffect(() => {
    if (!enabled) {
      setHoverInfo(null);
      elementPathRef.current = null;
      elementLabelRef.current = null;
      targetRef.current = null;
    }
  }, [enabled]);

  // Handle hover events
  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Skip if same element (prevents flashing on child boundaries)
      if (target === targetRef.current) return;
      targetRef.current = target;

      // Check if element should be ignored
      if (
        target.closest('[data-annotation-popup]') ||
        target.closest('[data-toolbar]')
      ) {
        if (hoverInfoRef.current) {
          elementPathRef.current = null;
          elementLabelRef.current = null;
          setHoverInfo(null);
        }
        return;
      }

      // Schedule position update via RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;

        // Get element dimensions
        const rect = target.getBoundingClientRect();

        // Update motion values (no re-render)
        highlightX.set(rect.left);
        highlightY.set(rect.top);
        highlightWidth.set(rect.width);
        highlightHeight.set(rect.height);
        tooltipX.set(rect.left);
        tooltipY.set(rect.bottom + TOOLTIP_OFFSET);

        // Get element identity
        const { name, path } = identifyElement(target);

        // Only update state if element identity changed
        if (elementPathRef.current !== path || elementLabelRef.current !== name) {
          elementPathRef.current = path;
          elementLabelRef.current = name;
          setHoverInfo({ element: name });
        } else if (!hoverInfoRef.current) {
          // Re-set hover info if it was cleared
          setHoverInfo({ element: name });
        }
      });
    },
    // Motion values are stable refs that never change identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mouseover', handleMouseOver);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);

      // Cancel any pending RAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Clear refs
      targetRef.current = null;
    };
  }, [enabled, handleMouseOver]);

  return {
    hoverInfo,
    hasTarget: hoverInfo !== null,
    highlightX,
    highlightY,
    highlightWidth,
    highlightHeight,
    tooltipX,
    tooltipY,
  };
}
