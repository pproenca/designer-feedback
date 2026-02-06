import {useCallback, useEffect, useState} from 'react';
import {DEFAULT_SETTINGS} from '@/shared/settings';
import {backgroundMessenger} from '@/utils/messaging';
import {settingsLightMode} from '@/utils/storage-items';
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
    const unwatchLightMode = settingsLightMode.watch(newValue => {
      setSettings(prev =>
        prev.lightMode === newValue ? prev : {...prev, lightMode: newValue}
      );
    });

    return () => {
      unwatchLightMode();
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
