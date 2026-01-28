// Toolbar position persistence utilities
// Saves toolbar position per-origin to chrome.storage.local

import type { Position } from '@/hooks/useDraggable';

const STORAGE_KEY_PREFIX = 'designer-feedback:toolbar-position:';

export function getToolbarPositionKey(): string {
  return `${STORAGE_KEY_PREFIX}${window.location.origin}`;
}

export async function saveToolbarPosition(position: Position): Promise<void> {
  const key = getToolbarPositionKey();
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: position }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to save position'));
        return;
      }
      resolve();
    });
  });
}

export async function loadToolbarPosition(): Promise<Position | null> {
  const key = getToolbarPositionKey();
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ [key]: null }, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to load position'));
        return;
      }
      const position = result[key] as Position | null | undefined;
      resolve(position ?? null);
    });
  });
}
