import type { HTMLAttributes, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act, within } from '@testing-library/react';
import { ExportModal } from './index';
import { exportAsImageWithNotes, exportAsSnapshotImage } from '@/utils/export';
import { isRestrictedPage } from '@/utils/screenshot';
import type { Annotation } from '@/types';

// Verify ExportModal is a named export (supports lazy loading with transform)
describe('ExportModal module structure', () => {
  it('exports ExportModal as a named export for lazy loading', async () => {
    const module = await import('./index');
    expect(module.ExportModal).toBeDefined();
    expect(typeof module.ExportModal).toBe('function');
  });

  it('can be dynamically imported', async () => {
    const loadModule = () => import('./index').then((m) => ({ default: m.ExportModal }));
    const module = await loadModule();
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});

// Mock export utilities
vi.mock('@/utils/export', () => ({
  exportAsImageWithNotes: vi.fn().mockResolvedValue(undefined),
  exportAsSnapshotImage: vi.fn().mockResolvedValue({ captureMode: 'full' }),
}));

vi.mock('@/utils/screenshot', () => ({
  isRestrictedPage: vi.fn().mockReturnValue(false),
}));

// Mock Framer Motion to avoid animation timing issues in tests
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

const mockAnnotations: Annotation[] = [
  {
    id: '1',
    x: 100,
    y: 200,
    comment: 'Test annotation',
    category: 'bug',
    element: 'div',
    elementPath: 'body > div',
    timestamp: Date.now(),
    isFixed: false,
    boundingBox: { x: 100, y: 200, width: 50, height: 50 },
  },
];

describe('ExportModal', () => {
  const mockedExportAsImageWithNotes = vi.mocked(exportAsImageWithNotes);
  const mockedExportAsSnapshotImage = vi.mocked(exportAsSnapshotImage);
  const mockedIsRestrictedPage = vi.mocked(isRestrictedPage);

  // Create a mock shadow root for portal rendering
  let mockShadowHost: HTMLDivElement;
  let mockShadowRoot: ShadowRoot;
  // Shadow-scoped screen queries (portal renders into shadow root)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let screen: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockedExportAsImageWithNotes.mockResolvedValue(undefined);
    mockedExportAsSnapshotImage.mockResolvedValue({ captureMode: 'full' });
    mockedIsRestrictedPage.mockReturnValue(false);

    // Set up mock shadow DOM
    mockShadowHost = document.createElement('div');
    document.body.appendChild(mockShadowHost);
    mockShadowRoot = mockShadowHost.attachShadow({ mode: 'open' });
    // Portal renders into shadow root, so query within it
    screen = within(mockShadowRoot as unknown as HTMLElement);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    // Clean up mock shadow DOM
    if (mockShadowHost.parentNode) {
      mockShadowHost.parentNode.removeChild(mockShadowHost);
    }
  });

  it('clears timeout when component unmounts before auto-close', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const onClose = vi.fn();

    const { unmount } = render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    // Click export button to trigger the auto-close timer
    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      // Wait for export to complete (mocked to resolve immediately)
      await vi.runAllTimersAsync();
    });

    // Unmount before the 1500ms auto-close timer fires
    vi.advanceTimersByTime(500);
    unmount();

    // clearTimeout should have been called during cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('does not call onClose after component unmounts', async () => {
    const onClose = vi.fn();

    const { unmount } = render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    // Click export button to trigger the auto-close timer
    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      // Wait for export to complete
      await vi.runAllTimersAsync();
    });

    // Reset onClose mock to track only post-export calls
    onClose.mockClear();

    // Unmount before the 1500ms timer fires
    vi.advanceTimersByTime(500);
    unmount();

    // Advance past when the timer would have fired
    vi.advanceTimersByTime(2000);

    // onClose should NOT have been called after unmount
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stores timer ID in ref for cleanup', async () => {
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    // Click export button
    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      // Wait for export to complete
      await vi.runAllTimersAsync();
    });

    // Advance past the auto-close timer
    act(() => {
      vi.advanceTimersByTime(1600);
    });

    // onClose should have been called by the timer
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('downloads snapshot and auto-closes on success', async () => {
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(mockedExportAsSnapshotImage).toHaveBeenCalledWith(mockAnnotations);
    expect(screen.getByText(/snapshot downloaded\./i)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows warning when snapshot uses placeholder and does not auto-close', async () => {
    mockedExportAsSnapshotImage.mockResolvedValue({ captureMode: 'placeholder' });
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/snapshot downloaded, but the screenshot was unavailable/i)).toBeInTheDocument();
    vi.advanceTimersByTime(2000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows warning when snapshot falls back to viewport capture', async () => {
    mockedExportAsSnapshotImage.mockResolvedValue({ captureMode: 'viewport' });
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/only the visible area was captured/i)).toBeInTheDocument();
    vi.advanceTimersByTime(2000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('exports markdown to clipboard and auto-closes', async () => {
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    // Click on the Markdown label to select it (Base UI RadioGroup structure)
    const markdownLabel = screen.getByText('Markdown (Clipboard)').closest('label');
    await act(async () => {
      fireEvent.click(markdownLabel!);
    });

    const exportButton = screen.getByRole('button', { name: /copy markdown/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(mockedExportAsImageWithNotes).toHaveBeenCalledWith(mockAnnotations);
    expect(screen.getByText(/markdown copied to clipboard/i)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables snapshot option on restricted pages', async () => {
    mockedIsRestrictedPage.mockReturnValue(true);

    render(<ExportModal annotations={mockAnnotations} onClose={() => {}} shadowRoot={mockShadowRoot} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Snapshot option should be disabled (Base UI uses data-disabled attribute)
    const radios = screen.getAllByRole('radio');
    const snapshotRadio = radios.find((r: HTMLElement) => r.hasAttribute('data-disabled'));
    expect(snapshotRadio).toBeInTheDocument();

    // Should show "not available" message
    expect(screen.getByText(/not available on browser pages/i)).toBeInTheDocument();
  });

  it('auto-selects markdown format on restricted pages', async () => {
    mockedIsRestrictedPage.mockReturnValue(true);

    render(<ExportModal annotations={mockAnnotations} onClose={() => {}} shadowRoot={mockShadowRoot} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Markdown option should be selected (Base UI RadioGroup)
    const radios = screen.getAllByRole('radio');
    // On restricted pages, markdown (image-notes) is auto-selected
    // The non-disabled radio with aria-checked=true should be the markdown option
    const selectedRadio = radios.find((r: HTMLElement) => r.getAttribute('aria-checked') === 'true' && !r.hasAttribute('data-disabled'));
    expect(selectedRadio).toBeInTheDocument();
  });

  it('shows error when export fails', async () => {
    mockedExportAsSnapshotImage.mockRejectedValue(new Error('Network error'));
    const onClose = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} shadowRoot={mockShadowRoot} />);

    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Export failed:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});
