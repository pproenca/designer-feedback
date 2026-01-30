import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import { sendMessage } from '@/utils/messaging';
import { settingsEnabled, settingsLightMode } from '@/utils/storage-items';
import type { Settings } from '@/types';

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
    const unwatchEnabled = settingsEnabled.watch((newValue) => {
      setSettings((prev) =>
        prev.enabled === newValue ? prev : { ...prev, enabled: newValue }
      );
    });
    const unwatchLightMode = settingsLightMode.watch((newValue) => {
      setSettings((prev) =>
        prev.lightMode === newValue ? prev : { ...prev, lightMode: newValue }
      );
    });

    return () => {
      unwatchEnabled();
      unwatchLightMode();
    };
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
