import {FeedbackToolbar} from '@/components/FeedbackToolbar';

interface AppProps {
  shadowRoot: ShadowRoot;
}

export function App({shadowRoot}: AppProps) {
  return <FeedbackToolbar shadowRoot={shadowRoot} />;
}
