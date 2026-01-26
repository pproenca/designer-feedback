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
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (response?.settings) {
        const settings = response.settings as Settings;
        setEnabled(settings.enabled);
        setLightMode(settings.lightMode);
      }
    });

    // Listen for toggle messages from popup
    const handleMessage = (message: { type: string; enabled?: boolean }) => {
      if (message.type === 'TOGGLE_TOOLBAR' && message.enabled !== undefined) {
        setEnabled(message.enabled);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
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
