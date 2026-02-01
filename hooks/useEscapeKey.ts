import {useEffect, useRef} from 'react';

type EscapeKeyHandler = () => void;

interface EscapeKeyState {
  [key: string]: unknown;
}

export function useEscapeKey<T extends EscapeKeyState>(
  state: T,
  handlers: Array<{condition: (state: T) => boolean; handler: EscapeKeyHandler}>
) {
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        const currentState = stateRef.current;

        for (const {condition, handler} of handlers) {
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
