import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Settings } from '@/types';

type StorageChangeEntry = { newValue?: unknown; oldValue?: unknown };

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let isCancelled = false;

    browser.storage.sync
      .get(DEFAULT_SETTINGS)
      .then((result) => {
        if (!isCancelled) {
          setSettings(result as Settings);
        }
      })
      .catch((error) => {
        console.error('Failed to get settings:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, StorageChangeEntry>,
      area: string
    ) => {
      if (area !== 'sync') return;
      if (!changes.enabled && !changes.lightMode) return;

      setSettings((prev) => {
        let nextSettings = prev;
        if (changes.enabled || changes.lightMode) {
          nextSettings = { ...prev };
          if (changes.enabled) {
            nextSettings.enabled = Boolean(changes.enabled.newValue);
          }
          if (changes.lightMode) {
            nextSettings.lightMode = Boolean(changes.lightMode.newValue);
          }
        }
        return nextSettings;
      });
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const updateSettings = useCallback((next: Partial<Settings>) => {
    if (!Object.keys(next).length) return;

    setSettings((prev) => ({ ...prev, ...next }));
    browser.storage.sync.set(next).catch((error) => {
      console.error('Failed to save settings:', error);
    });
  }, []);

  return { settings, updateSettings };
}
