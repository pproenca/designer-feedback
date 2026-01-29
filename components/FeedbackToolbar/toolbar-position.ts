// Toolbar position persistence utilities
// Saves toolbar position per-origin to browser.storage.local

import type { Position } from '@/hooks/useDraggable';

const STORAGE_KEY_PREFIX = 'designer-feedback:toolbar-position:';

export function getToolbarPositionKey(): string {
  return `${STORAGE_KEY_PREFIX}${window.location.origin}`;
}

export async function saveToolbarPosition(position: Position): Promise<void> {
  const key = getToolbarPositionKey();
  await browser.storage.local.set({ [key]: position });
}

export async function loadToolbarPosition(): Promise<Position | null> {
  const key = getToolbarPositionKey();
  const result = await browser.storage.local.get({ [key]: null });
  const position = result[key] as Position | null | undefined;
  return position ?? null;
}
