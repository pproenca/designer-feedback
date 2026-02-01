import {useEffect} from 'react';

type ClickOutsideHandler = () => void;

export function useClickOutside(
  enabled: boolean,
  selectors: string[],
  onClickOutside: ClickOutsideHandler
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: MouseEvent) => {
      const path = event.composedPath ? event.composedPath() : [];
      const isInside = path.some(node => {
        if (!(node instanceof HTMLElement)) return false;

        for (const selector of selectors) {
          if (node.hasAttribute(selector)) return true;
          if (node.closest?.(`[${selector}]`)) return true;
        }
        return false;
      });

      if (!isInside) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [enabled, selectors, onClickOutside]);
}
