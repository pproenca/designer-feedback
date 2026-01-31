// =============================================================================
// Internal UI Event Bus (content script only)
// =============================================================================

import mitt, { type Handler } from 'mitt';

// Event types for the UI event bus
type UiEvents = {
  'hide-ui': void;
  'show-ui': void;
  'open-export': void;
  'location-changed': { newUrl: string; oldUrl: string };
};

// Create typed mitt instance
const emitter = mitt<UiEvents>();

export type UiEventName = keyof UiEvents;

/**
 * Subscribe to a UI event
 * @returns Unsubscribe function
 */
export function onUiEvent<E extends UiEventName>(
  event: E,
  handler: Handler<UiEvents[E]>
): () => void {
  emitter.on(event, handler);
  return () => emitter.off(event, handler);
}

/**
 * Emit a UI event to all subscribers
 * Overloaded for events with and without payloads
 */
/* eslint-disable no-redeclare */
export function emitUiEvent(event: 'hide-ui' | 'show-ui' | 'open-export'): void;
export function emitUiEvent(
  event: 'location-changed',
  payload: { newUrl: string; oldUrl: string }
): void;
export function emitUiEvent(
  event: UiEventName,
  payload?: { newUrl: string; oldUrl: string }
): void {
  if (event === 'location-changed' && payload) {
    emitter.emit('location-changed', payload);
  } else {
    emitter.emit(event as 'hide-ui' | 'show-ui' | 'open-export');
  }
}
/* eslint-enable no-redeclare */
