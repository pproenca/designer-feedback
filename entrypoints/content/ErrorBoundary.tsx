import {Component, ErrorInfo, ReactNode} from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false, error: null};

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Designer Feedback] React error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '13px',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            <strong>Designer Feedback crashed.</strong> Reload the page to
            recover.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
