import {storage} from 'wxt/utils/storage';
import type {PendingCaptureRequest} from '@/types';
import {DEFAULT_SETTINGS} from '@/shared/settings';

export const settingsEnabled = storage.defineItem<boolean>('sync:enabled', {
  fallback: true,
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

export const pendingCaptureTabs = storage.defineItem<
  Record<string, PendingCaptureRequest>
>('session:designer-feedback:pending-capture-tabs', {
  fallback: {},
  version: 1,
});

export const pendingCaptureTabsLocalFallback = storage.defineItem<
  Record<string, PendingCaptureRequest>
>('local:designer-feedback:pending-capture-tabs', {
  fallback: {},
  version: 1,
});
