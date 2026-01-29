import { useCallback } from 'react';
import { FeedbackToolbar } from '@/components/FeedbackToolbar';
import { useSettings } from '@/hooks/useSettings';

interface AppProps {
  shadowRoot: ShadowRoot;
}

export function App({ shadowRoot }: AppProps) {
  const { settings, updateSettings } = useSettings();
  const { enabled, lightMode } = settings;

  const handleLightModeChange = useCallback((nextLightMode: boolean) => {
    updateSettings({ lightMode: nextLightMode });
  }, [updateSettings]);

  if (!enabled) {
    return null;
  }

  // Dark mode is the default; lightMode=true means light theme
  // We add 'dark' class when NOT in light mode for Tailwind dark: variant
  return (
    <FeedbackToolbar
      shadowRoot={shadowRoot}
      lightMode={lightMode}
      onLightModeChange={handleLightModeChange}
    />
  );
}
