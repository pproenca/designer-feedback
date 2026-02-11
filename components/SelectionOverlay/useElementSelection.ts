import {useState, useRef, useEffect, useCallback} from 'react';
import {useMotionValue, type MotionValue} from '@/utils/motion';
import {identifyElement} from '@/utils/dom/element-identification';

export interface HoverInfo {
  element: string;
}

export interface UseElementSelectionOptions {
  enabled: boolean;
}

export interface UseElementSelectionResult {
  hoverInfo: HoverInfo | null;

  hasTarget: boolean;

  highlightX: MotionValue<number>;
  highlightY: MotionValue<number>;
  highlightWidth: MotionValue<number>;
  highlightHeight: MotionValue<number>;

  tooltipX: MotionValue<number>;
  tooltipY: MotionValue<number>;
}

const TOOLTIP_OFFSET = 8;

export function useElementSelection({
  enabled,
}: UseElementSelectionOptions): UseElementSelectionResult {
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  const highlightX = useMotionValue(0);
  const highlightY = useMotionValue(0);
  const highlightWidth = useMotionValue(0);
  const highlightHeight = useMotionValue(0);
  const tooltipX = useMotionValue(0);
  const tooltipY = useMotionValue(0);

  const elementPathRef = useRef<string | null>(null);
  const elementLabelRef = useRef<string | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const hoverInfoRef = useRef<HoverInfo | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    hoverInfoRef.current = hoverInfo;
  }, [hoverInfo]);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- cleanup on disable
      setHoverInfo(null);
      elementPathRef.current = null;
      elementLabelRef.current = null;
      targetRef.current = null;
    }
  }, [enabled]);

  /* eslint-disable react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps -- MotionValues are stable refs */
  const handleMouseOver = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target === targetRef.current) return;
      targetRef.current = target;

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

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;

        const rect = target.getBoundingClientRect();

        highlightX.set(rect.left);
        highlightY.set(rect.top);
        highlightWidth.set(rect.width);
        highlightHeight.set(rect.height);
        tooltipX.set(rect.left);
        tooltipY.set(rect.bottom + TOOLTIP_OFFSET);

        const {name, path} = identifyElement(target);

        if (
          elementPathRef.current !== path ||
          elementLabelRef.current !== name
        ) {
          elementPathRef.current = path;
          elementLabelRef.current = name;
          setHoverInfo({element: name});
        } else if (!hoverInfoRef.current) {
          setHoverInfo({element: name});
        }
      });
    },

    []
  );
  /* eslint-enable react-hooks/preserve-manual-memoization, react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mouseover', handleMouseOver);

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

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
