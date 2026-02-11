import type {Position} from '@/types/position';
import {getExtensionApi} from '@/utils/extension-api';

const TOOLBAR_POSITIONS_KEY = 'designer-feedback:toolbar-positions';

async function getStoredToolbarPositions(): Promise<Record<string, Position>> {
  const extensionApi = getExtensionApi();
  const result = await extensionApi.storage.local.get(TOOLBAR_POSITIONS_KEY);
  const raw = result[TOOLBAR_POSITIONS_KEY];
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return raw as Record<string, Position>;
}

async function setStoredToolbarPositions(
  positions: Record<string, Position>
): Promise<void> {
  const extensionApi = getExtensionApi();
  await extensionApi.storage.local.set({
    [TOOLBAR_POSITIONS_KEY]: positions,
  });
}

function getOriginKey(): string {
  return window.location.origin;
}

export async function saveToolbarPosition(position: Position): Promise<void> {
  const origin = getOriginKey();
  try {
    const positions = await getStoredToolbarPositions();
    await setStoredToolbarPositions({
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
    const positions = await getStoredToolbarPositions();
    return positions[origin] ?? null;
  } catch (error) {
    console.warn('Failed to load toolbar position:', error);
    return null;
  }
}
