import { useState, useEffect, useCallback } from 'react';
import { FeedbackToolbar } from '@/components/FeedbackToolbar';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Settings } from '@/types';

interface AppProps {
  shadowRoot: ShadowRoot;
}

export function App({ shadowRoot }: AppProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const { enabled, lightMode } = settings;

  const handleLightModeChange = useCallback((nextLightMode: boolean) => {
    setSettings((prev) => ({ ...prev, lightMode: nextLightMode }));
    browser.storage.sync.set({ lightMode: nextLightMode }).catch((error) => {
      console.error('Failed to save light mode setting:', error);
    });
  }, []);

  useEffect(() => {
    // Load initial settings
    browser.storage.sync.get(DEFAULT_SETTINGS).then((result) => {
      const settings = result as Settings;
      setSettings(settings);
    }).catch((error) => {
      console.error('Failed to get settings:', error);
    });

    const handleStorageChanges = (
      changes: { [key: string]: { newValue?: unknown; oldValue?: unknown } },
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

  if (!enabled) {
    return null;
  }

  return (
    <FeedbackToolbar
      shadowRoot={shadowRoot}
      lightMode={lightMode}
      onLightModeChange={handleLightModeChange}
    />
  );
}
