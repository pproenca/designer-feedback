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

export async function getLocalStorage<T>(key: string, fallback: T): Promise<T> {
  try {
    const extensionApi = getExtensionApi();
    const result = await extensionApi.storage.local.get(key);
    const value: unknown = result[key];
    if (value === undefined || value === null) return fallback;
    return value as T;
  } catch (error) {
    console.warn('Storage access failed (get):', error);
    return fallback;
  }
}

export async function setLocalStorage(
  values: Record<string, unknown>
): Promise<void> {
  if (!Object.keys(values).length) return;
  const extensionApi = getExtensionApi();
  await extensionApi.storage.local.set(values);
}

export async function removeLocalStorage(
  keys: string | string[]
): Promise<void> {
  const normalizedKeys = Array.isArray(keys) ? keys : [keys];
  if (!normalizedKeys.length) return;
  const extensionApi = getExtensionApi();
  await extensionApi.storage.local.remove(normalizedKeys);
}

export async function getAllLocalStorage(): Promise<Record<string, unknown>> {
  try {
    const extensionApi = getExtensionApi();
    return await extensionApi.storage.local.get(null);
  } catch (error) {
    console.warn('Storage access failed (get all):', error);
    return {};
  }
}
