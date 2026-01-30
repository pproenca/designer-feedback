// Toolbar position persistence utilities
// Saves toolbar position per-origin to browser.storage.local

import type { Position } from '@/hooks/useDraggable';

const STORAGE_KEY_PREFIX = 'designer-feedback:toolbar-position:';

export function getToolbarPositionKey(): string {
  return `${STORAGE_KEY_PREFIX}${window.location.origin}`;
}

export async function saveToolbarPosition(position: Position): Promise<void> {
  const key = getToolbarPositionKey();
  const storage =
    (typeof browser !== 'undefined' && browser.storage?.local
      ? browser.storage.local
      : null) ??
    (typeof chrome !== 'undefined' && chrome.storage?.local
      ? chrome.storage.local
      : null);
  if (!storage) return;
  try {
    await storage.set({ [key]: position });
  } catch (error) {
    console.warn('Failed to save toolbar position:', error);
  }
}

export async function loadToolbarPosition(): Promise<Position | null> {
  const key = getToolbarPositionKey();
  const storage =
    (typeof browser !== 'undefined' && browser.storage?.local
      ? browser.storage.local
      : null) ??
    (typeof chrome !== 'undefined' && chrome.storage?.local
      ? chrome.storage.local
      : null);
  if (!storage) return null;
  try {
    const result = await storage.get({ [key]: null });
    const position = (result as Record<string, Position | null | undefined>)[key];
    return position ?? null;
  } catch (error) {
    console.warn('Failed to load toolbar position:', error);
    return null;
  }
}
