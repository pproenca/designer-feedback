import { useState, useEffect } from 'react';
import { FeedbackToolbar } from '@/components/FeedbackToolbar';
import type { Settings } from '@/types';

interface AppProps {
  shadowRoot: ShadowRoot;
}

export function App({ shadowRoot }: AppProps) {
  const [enabled, setEnabled] = useState(true);
  const [lightMode, setLightMode] = useState(false);

  useEffect(() => {
    // Load initial settings
    chrome.storage.sync.get({ enabled: true, lightMode: false }, (result) => {
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
      onLightModeChange={setLightMode}
    />
  );
}
