// =============================================================================
// Internal UI Event Bus (content script only)
// =============================================================================

import mitt from 'mitt';

// Event types for the UI event bus
type UiEvents = {
  'hide-ui': void;
  'show-ui': void;
  'open-export': void;
};

// Create typed mitt instance
const emitter = mitt<UiEvents>();

export type UiEventName = keyof UiEvents;
export type UiEventHandler = () => void;

/**
 * Subscribe to a UI event
 * @returns Unsubscribe function
 */
export function onUiEvent(event: UiEventName, handler: UiEventHandler): () => void {
  emitter.on(event, handler);
  return () => emitter.off(event, handler);
}

/**
 * Emit a UI event to all subscribers
 */
export function emitUiEvent(event: UiEventName): void {
  emitter.emit(event);
}
