import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { sendMessage } from '@/utils/messaging';
import type { Settings } from '@/types';

type StorageChangeEntry = { newValue?: unknown; oldValue?: unknown };
type SettingsResponse = { type: string; settings: Settings; error?: string };

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let isCancelled = false;

    sendMessage<SettingsResponse>({ type: 'GET_SETTINGS' })
      .then((response) => {
        if (!isCancelled && response.settings) {
          setSettings(response.settings);
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

    const storage =
      (typeof browser !== 'undefined' ? browser.storage : undefined) ??
      (typeof chrome !== 'undefined' ? chrome.storage : undefined);
    if (!storage?.onChanged) {
      return;
    }
    storage.onChanged.addListener(handleStorageChange);
    return () => storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const updateSettings = useCallback((next: Partial<Settings>) => {
    if (!Object.keys(next).length) return;

    setSettings((prev) => {
      const newSettings = { ...prev, ...next };
      sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings }).catch((error) => {
        console.error('Failed to save settings:', error);
      });
      return newSettings;
    });
  }, []);

  return { settings, updateSettings };
}
