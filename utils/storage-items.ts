import {storage} from 'wxt/utils/storage';
import {DEFAULT_SETTINGS} from '@/shared/settings';

export const settingsEnabled = storage.defineItem<boolean>('sync:enabled', {
  fallback: DEFAULT_SETTINGS.enabled,
  version: 1,
});

export const settingsLightMode = storage.defineItem<boolean>('sync:lightMode', {
  fallback: DEFAULT_SETTINGS.lightMode,
  version: 1,
});

export const lastCleanupTimestamp = storage.defineItem<number>(
  'local:designer-feedback:last-cleanup',
  {
    fallback: 0,
    version: 1,
  }
);

export const toolbarPositions = storage.defineItem<
  Record<string, {x: number; y: number}>
>('local:designer-feedback:toolbar-positions', {
  fallback: {},
  version: 1,
});
