export type StorageChangeRecord = Record<
  string,
  {newValue?: unknown; oldValue?: unknown}
>;

export interface ExtensionApi {
  storage: {
    local: {
      get(
        keys?: string | string[] | null | Record<string, unknown>
      ): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
    onChanged: {
      addListener(
        listener: (changes: StorageChangeRecord, areaName: string) => void
      ): void;
      removeListener(
        listener: (changes: StorageChangeRecord, areaName: string) => void
      ): void;
    };
    sync?: {
      onChanged?: {
        addListener(listener: (changes: StorageChangeRecord) => void): void;
        removeListener(listener: (changes: StorageChangeRecord) => void): void;
      };
    };
  };
}

export function getExtensionApi(): ExtensionApi {
  const runtime = globalThis as typeof globalThis & {
    browser?: ExtensionApi;
    chrome?: ExtensionApi;
  };
  const api = runtime.browser ?? runtime.chrome;
  if (!api?.storage?.local || !api.storage.onChanged) {
    throw new Error('Browser storage API is unavailable in this context');
  }
  return api;
}
