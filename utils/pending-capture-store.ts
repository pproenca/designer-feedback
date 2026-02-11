import type {PendingCaptureRequest} from '@/types';
import {
  pendingCaptureTabs,
  pendingCaptureTabsLocalFallback,
} from '@/utils/storage-items';

export type PendingCaptureStoreValue = Record<string, PendingCaptureRequest>;

interface PendingCaptureStorageItem {
  getValue(): Promise<PendingCaptureStoreValue>;
  setValue(value: PendingCaptureStoreValue): Promise<void>;
}

interface PendingCaptureStoreDeps {
  sessionStore: PendingCaptureStorageItem;
  fallbackStore: PendingCaptureStorageItem;
  warn: (message: string, error: unknown) => void;
}

export interface PendingCaptureStoreAdapter {
  getValue(): Promise<PendingCaptureStoreValue>;
  setValue(value: PendingCaptureStoreValue): Promise<void>;
}

const defaultDeps: PendingCaptureStoreDeps = {
  sessionStore: pendingCaptureTabs,
  fallbackStore: pendingCaptureTabsLocalFallback,
  warn: (message, error) => console.warn(message, error),
};

export function createPendingCaptureStoreAdapter(
  deps: PendingCaptureStoreDeps = defaultDeps
): PendingCaptureStoreAdapter {
  return {
    async getValue(): Promise<PendingCaptureStoreValue> {
      try {
        return await deps.sessionStore.getValue();
      } catch (sessionError) {
        deps.warn(
          'Session storage unavailable for pending captures, using local fallback.',
          sessionError
        );
      }

      try {
        return await deps.fallbackStore.getValue();
      } catch (fallbackError) {
        deps.warn(
          'Local fallback unavailable for pending captures, returning empty store.',
          fallbackError
        );
        return {};
      }
    },

    async setValue(value: PendingCaptureStoreValue): Promise<void> {
      try {
        await deps.sessionStore.setValue(value);
        return;
      } catch (sessionError) {
        deps.warn(
          'Session storage write failed for pending captures, using local fallback.',
          sessionError
        );
      }

      await deps.fallbackStore.setValue(value);
    },
  };
}
