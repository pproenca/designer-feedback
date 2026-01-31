// Toolbar position persistence utilities
// Saves toolbar position per-origin using WXT storage defineItem

import type { Position } from '@/hooks/useDraggable';
import { toolbarPositions } from '@/utils/storage-items';

/**
 * Get the origin key for current page
 */
function getOriginKey(): string {
  return window.location.origin;
}

/**
 * Save toolbar position for the current origin
 */
export async function saveToolbarPosition(position: Position): Promise<void> {
  const origin = getOriginKey();
  try {
    const positions = await toolbarPositions.getValue();
    await toolbarPositions.setValue({
      ...positions,
      [origin]: position,
    });
  } catch (error) {
    console.warn('Failed to save toolbar position:', error);
  }
}

/**
 * Load toolbar position for the current origin
 */
export async function loadToolbarPosition(): Promise<Position | null> {
  const origin = getOriginKey();
  try {
    const positions = await toolbarPositions.getValue();
    return positions[origin] ?? null;
  } catch (error) {
    console.warn('Failed to load toolbar position:', error);
    return null;
  }
}
