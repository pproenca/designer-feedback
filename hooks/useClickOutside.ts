import {useEffect, useRef} from 'react';

type ClickOutsideHandler = () => void;

export function useClickOutside(
  enabled: boolean,
  selectors: string[],
  onClickOutside: ClickOutsideHandler
) {
  const selectorsRef = useRef(selectors);
  const onClickOutsideRef = useRef(onClickOutside);

  useEffect(() => {
    selectorsRef.current = selectors;
    onClickOutsideRef.current = onClickOutside;
  });

  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: MouseEvent) => {
      const path = event.composedPath ? event.composedPath() : [];
      const isInside = path.some(node => {
        if (!(node instanceof HTMLElement)) return false;

        for (const selector of selectorsRef.current) {
          if (node.hasAttribute(selector)) return true;
          if (node.closest?.(`[${selector}]`)) return true;
        }
        return false;
      });

      if (!isInside) {
        onClickOutsideRef.current();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [enabled]);
}
