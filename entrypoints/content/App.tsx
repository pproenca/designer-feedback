import { useState, useEffect, useCallback } from 'react';
import { FeedbackToolbar } from '@/components/FeedbackToolbar';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Settings } from '@/types';

interface AppProps {
  shadowRoot: ShadowRoot;
}

export function App({ shadowRoot }: AppProps) {
  const [enabled, setEnabled] = useState(DEFAULT_SETTINGS.enabled);
  const [lightMode, setLightMode] = useState(DEFAULT_SETTINGS.lightMode);

  const handleLightModeChange = useCallback((nextLightMode: boolean) => {
    setLightMode(nextLightMode);
    browser.storage.sync.set({ lightMode: nextLightMode }).catch((error) => {
      console.error('Failed to save light mode setting:', error);
    });
  }, []);

  useEffect(() => {
    // Load initial settings
    browser.storage.sync.get(DEFAULT_SETTINGS).then((result) => {
      const settings = result as Settings;
      setEnabled(settings.enabled);
      setLightMode(settings.lightMode);
    }).catch((error) => {
      console.error('Failed to get settings:', error);
    });

    const handleStorageChanges = (
      changes: { [key: string]: { newValue?: unknown; oldValue?: unknown } },
      area: string
    ) => {
      if (area !== 'sync') return;
      if (changes.enabled) {
        setEnabled(Boolean(changes.enabled.newValue));
      }
      if (changes.lightMode) {
        setLightMode(Boolean(changes.lightMode.newValue));
      }
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
