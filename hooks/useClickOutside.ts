import { useEffect } from 'react';

type ClickOutsideHandler = () => void;

/**
 * Hook that handles click outside detection using composedPath for Shadow DOM support.
 *
 * @param enabled - Whether to listen for clicks
 * @param selectors - Data attribute selectors to check (e.g., 'data-annotation-popup')
 * @param onClickOutside - Handler called when clicking outside all selectors
 */
export function useClickOutside(
  enabled: boolean,
  selectors: string[],
  onClickOutside: ClickOutsideHandler
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: MouseEvent) => {
      const path = event.composedPath ? event.composedPath() : [];
      const isInside = path.some((node) => {
        if (!(node instanceof HTMLElement)) return false;

        // Check if node has any of the specified data attributes
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
