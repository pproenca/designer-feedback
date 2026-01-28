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
    chrome.storage.sync.set({ lightMode: nextLightMode }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save light mode setting:', chrome.runtime.lastError.message);
      }
    });
  }, []);

  useEffect(() => {
    // Load initial settings
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get settings:', chrome.runtime.lastError.message);
        return;
      }
      const settings = result as Settings;
      setEnabled(settings.enabled);
      setLightMode(settings.lightMode);
    });

    const handleStorageChanges = (
      changes: { [key: string]: chrome.storage.StorageChange },
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

    chrome.storage.onChanged.addListener(handleStorageChanges);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanges);
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
