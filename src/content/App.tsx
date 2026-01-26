import { useState, useEffect } from 'react';
import { FeedbackToolbar } from '@/components/FeedbackToolbar';
import { getStorageKey, getAnnotationCount } from '@/utils/storage';
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

    // Listen for messages from popup
    const handleMessage = (
      message: { type: string; enabled?: boolean },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => {
      if (message.type === 'TOGGLE_TOOLBAR' && message.enabled !== undefined) {
        setEnabled(message.enabled);
        return false;
      }

      if (message.type === 'GET_ANNOTATION_COUNT') {
        const url = getStorageKey();
        getAnnotationCount(url)
          .then((count) => sendResponse({ count }))
          .catch(() => sendResponse({ count: 0 }));
        return true; // Keep channel open for async response
      }

      return false;
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
