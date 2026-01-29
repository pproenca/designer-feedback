// =============================================================================
// Internal UI Event Bus (content script only)
// =============================================================================

export type UiEventName = 'hide-ui' | 'show-ui' | 'open-export';
export type UiEventHandler = () => void;

const listeners = new Map<UiEventName, Set<UiEventHandler>>();

export function onUiEvent(event: UiEventName, handler: UiEventHandler): () => void {
  const existing = listeners.get(event) ?? new Set<UiEventHandler>();
  existing.add(handler);
  listeners.set(event, existing);

  return () => {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      listeners.delete(event);
    }
  };
}

export function emitUiEvent(event: UiEventName): void {
  const set = listeners.get(event);
  if (!set || set.size === 0) return;
  set.forEach((handler) => handler());
}
