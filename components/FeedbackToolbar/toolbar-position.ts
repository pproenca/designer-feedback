import type {Position} from '@/types/position';
import {toolbarPositions} from '@/utils/storage-items';

function getOriginKey(): string {
  return window.location.origin;
}

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
