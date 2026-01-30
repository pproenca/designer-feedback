// Toolbar position persistence utilities
// Saves toolbar position per-origin to WXT storage (local)

import type { Position } from '@/hooks/useDraggable';
import { storage } from 'wxt/utils/storage';

const STORAGE_KEY_PREFIX = 'designer-feedback:toolbar-position:';

export function getToolbarPositionKey(): string {
  return `${STORAGE_KEY_PREFIX}${window.location.origin}`;
}

export async function saveToolbarPosition(position: Position): Promise<void> {
  const key = getToolbarPositionKey();
  try {
    await storage.setItem(`local:${key}`, position);
  } catch (error) {
    console.warn('Failed to save toolbar position:', error);
  }
}

export async function loadToolbarPosition(): Promise<Position | null> {
  const key = getToolbarPositionKey();
  try {
    return await storage.getItem<Position | null>(`local:${key}`, { fallback: null });
  } catch (error) {
    console.warn('Failed to load toolbar position:', error);
    return null;
  }
}
