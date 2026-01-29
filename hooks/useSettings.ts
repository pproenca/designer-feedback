import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Settings } from '@/types';

type StorageChange = { newValue?: unknown; oldValue?: unknown };

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    browser.storage.sync
      .get(DEFAULT_SETTINGS)
      .then((result) => {
        if (!cancelled) {
          setSettings(result as Settings);
        }
      })
      .catch((error) => {
        console.error('Failed to get settings:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleStorageChanges = (
      changes: Record<string, StorageChange>,
      area: string
    ) => {
      if (area !== 'sync') return;
      if (!changes.enabled && !changes.lightMode) return;

      setSettings((prev) => {
        let next = prev;
        if (changes.enabled || changes.lightMode) {
          next = { ...prev };
          if (changes.enabled) {
            next.enabled = Boolean(changes.enabled.newValue);
          }
          if (changes.lightMode) {
            next.lightMode = Boolean(changes.lightMode.newValue);
          }
        }
        return next;
      });
    };

    browser.storage.onChanged.addListener(handleStorageChanges);
    return () => browser.storage.onChanged.removeListener(handleStorageChanges);
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
