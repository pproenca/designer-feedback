import { FeedbackToolbar } from '@/components/FeedbackToolbar';
import { useSettings } from '@/hooks/useSettings';

interface AppProps {
  shadowRoot: ShadowRoot;
}

export function App({ shadowRoot }: AppProps) {
  const { settings } = useSettings();
  const { enabled } = settings;

  if (!enabled) {
    return null;
  }

  return <FeedbackToolbar shadowRoot={shadowRoot} />;
}
