import {useCallback, useEffect, useState} from 'react';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {backgroundMessenger} from '@/utils/messaging';
import {getExtensionApi, type StorageChangeRecord} from '@/utils/extension-api';
import type {Settings} from '@/types';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let isCancelled = false;

    backgroundMessenger
      .sendMessage('getSettings', undefined)
      .then(response => {
        if (!isCancelled && response.settings) {
          setSettings(response.settings);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to get settings:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleStorageChanged = (
      changes: StorageChangeRecord,
      areaName: string
    ) => {
      if (areaName !== 'sync') {
        return;
      }
      const change = changes.lightMode;
      if (!change || typeof change.newValue !== 'boolean') {
        return;
      }
      const nextLightMode = change.newValue;
      setSettings(prev =>
        prev.lightMode === nextLightMode
          ? prev
          : {...prev, lightMode: nextLightMode}
      );
    };

    let extensionApi: ReturnType<typeof getExtensionApi> | null = null;
    const handleSyncAreaChanged = (changes: StorageChangeRecord) => {
      handleStorageChanged(changes, 'sync');
    };
    try {
      extensionApi = getExtensionApi();
      extensionApi.storage.onChanged.addListener(handleStorageChanged);
      extensionApi.storage.sync?.onChanged?.addListener(handleSyncAreaChanged);
    } catch (error) {
      console.warn('Storage change listener unavailable:', error);
    }

    return () => {
      extensionApi?.storage.onChanged.removeListener(handleStorageChanged);
      extensionApi?.storage.sync?.onChanged?.removeListener(
        handleSyncAreaChanged
      );
    };
  }, []);

  const updateSettings = useCallback((next: Partial<Settings>) => {
    if (!Object.keys(next).length) return;

    setSettings(prev => {
      const newSettings = {...prev, ...next};
      backgroundMessenger
        .sendMessage('saveSettings', newSettings)
        .catch((error: unknown) => {
          console.error('Failed to save settings:', error);
        });
      return newSettings;
    });
  }, []);

  return {settings, updateSettings};
}
