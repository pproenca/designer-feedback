import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for testing
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error during tests since we expect errors
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('catches errors and renders nothing by default', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Normal content')).not.toBeInTheDocument();
    expect(screen.queryByText('Test error')).not.toBeInTheDocument();
  });

  it('renders fallback when error occurs', () => {
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Normal content')).not.toBeInTheDocument();
  });

  it('logs errors via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // componentDidCatch should have logged the error
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorCall = consoleErrorSpy.mock.calls.find(
      (call) => call[0] === '[Designer Feedback] React error:'
    );
    expect(errorCall).toBeDefined();
  });

  it('does not render fallback when error does not occur', () => {
    render(
      <ErrorBoundary fallback={<div>Something went wrong</div>}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal content')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
