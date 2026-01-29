import { useEffect, useRef } from 'react';

type EscapeKeyHandler = () => void;

interface EscapeKeyState {
  [key: string]: unknown;
}

/**
 * Hook that handles escape key presses with a state ref pattern.
 * Uses a ref to avoid re-attaching event listeners when state changes.
 *
 * @param state - Current state object to track
 * @param handlers - Array of { condition, handler } objects evaluated in order
 */
export function useEscapeKey<T extends EscapeKeyState>(
  state: T,
  handlers: Array<{ condition: (state: T) => boolean; handler: EscapeKeyHandler }>
) {
  const stateRef = useRef(state);

  // Keep ref updated with latest state
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        const currentState = stateRef.current;

        // Find first matching handler and execute it
        for (const { condition, handler } of handlers) {
          if (condition(currentState)) {
            handler();
            return;
          }
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handlers]);
}
