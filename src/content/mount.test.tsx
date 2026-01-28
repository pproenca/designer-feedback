import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock the App component
vi.mock('./App', () => ({
  App: vi.fn(() => null),
}));

// Mock the style imports
vi.mock('./styles.scss?inline', () => ({ default: '' }));
vi.mock('@/components/FeedbackToolbar/styles.module.scss?inline', () => ({
  default: '',
}));
vi.mock('@/components/AnnotationPopup/styles.module.scss?inline', () => ({
  default: '',
}));
vi.mock('@/components/ExportModal/styles.module.scss?inline', () => ({
  default: '',
}));

describe('mount.tsx', () => {
  let originalBody: HTMLElement;

  beforeEach(() => {
    // Reset modules to ensure fresh imports
    vi.resetModules();
    // Store original body content
    originalBody = document.body.cloneNode(true) as HTMLElement;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    // Restore original body
    document.body.innerHTML = originalBody.innerHTML;
  });

  it('uses ErrorBoundary to wrap App', async () => {
    // Import the source file
    const mountSource = await import('./mount.tsx?raw');
    const sourceCode = mountSource.default;

    // Verify the source imports ErrorBoundary
    expect(sourceCode).toContain("import { ErrorBoundary }");
    expect(sourceCode).toContain("from './ErrorBoundary'");

    // Verify ErrorBoundary wraps App in the render call
    // App uses self-closing syntax: <App ... />
    expect(sourceCode).toMatch(/<ErrorBoundary[^>]*>[\s\S]*<App/);
    expect(sourceCode).toMatch(/<App[^>]*\/>[\s\S]*<\/ErrorBoundary>/);
  });
});
