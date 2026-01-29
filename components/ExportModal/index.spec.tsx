import type { HTMLAttributes, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ExportModal } from './index';
import { exportAsImageWithNotes, exportAsSnapshotImage } from '@/utils/export';
import { hasScreenshotPermission, requestScreenshotPermission } from '@/utils/permissions';
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

vi.mock('@/utils/permissions', () => ({
  hasScreenshotPermission: vi.fn().mockResolvedValue(true),
  requestScreenshotPermission: vi.fn().mockResolvedValue(true),
}));

// Mock Framer Motion to avoid animation timing issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
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
  const mockedHasScreenshotPermission = vi.mocked(hasScreenshotPermission);
  const mockedRequestScreenshotPermission = vi.mocked(requestScreenshotPermission);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockedExportAsImageWithNotes.mockResolvedValue(undefined);
    mockedExportAsSnapshotImage.mockResolvedValue({ captureMode: 'full' });
    mockedHasScreenshotPermission.mockResolvedValue(true);
    mockedRequestScreenshotPermission.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('clears timeout when component unmounts before auto-close', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const onClose = vi.fn();

    const { unmount } = render(
      <ExportModal annotations={mockAnnotations} onClose={onClose} />
    );

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

    const { unmount } = render(
      <ExportModal annotations={mockAnnotations} onClose={onClose} />
    );

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

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} />);

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

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} />);

    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(mockedRequestScreenshotPermission).toHaveBeenCalled();
    expect(mockedExportAsSnapshotImage).toHaveBeenCalledWith(mockAnnotations, {
      hasPermission: true,
    });
    expect(screen.getByText(/snapshot downloaded\./i)).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows warning when snapshot uses placeholder and does not auto-close', async () => {
    mockedExportAsSnapshotImage.mockResolvedValue({ captureMode: 'placeholder' });
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} />);

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

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} />);

    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(
      screen.getByText(/only the visible area was captured/i)
    ).toBeInTheDocument();
    vi.advanceTimersByTime(2000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('exports markdown to clipboard and auto-closes', async () => {
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} />);

    const markdownButton = screen.getByRole('radio', { name: /markdown/i });
    await act(async () => {
      fireEvent.click(markdownButton);
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

  it('shows permission callout when permission is denied', async () => {
    mockedHasScreenshotPermission.mockResolvedValue(false);

    render(<ExportModal annotations={mockAnnotations} onClose={() => {}} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByRole('button', { name: /grant access/i })).toBeInTheDocument();
  });

  it('handles permission request success', async () => {
    mockedHasScreenshotPermission.mockResolvedValue(false);
    mockedRequestScreenshotPermission.mockResolvedValue(true);

    render(<ExportModal annotations={mockAnnotations} onClose={() => {}} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    const grantButton = screen.getByRole('button', { name: /grant access/i });
    await act(async () => {
      fireEvent.click(grantButton);
      await vi.runAllTimersAsync();
    });

    expect(mockedRequestScreenshotPermission).toHaveBeenCalled();
    expect(screen.getByText(/permission granted/i)).toBeInTheDocument();
  });

  it('shows error when permission is denied on export', async () => {
    mockedRequestScreenshotPermission.mockResolvedValue(false);
    const onClose = vi.fn();

    render(<ExportModal annotations={mockAnnotations} onClose={onClose} />);

    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(mockedExportAsSnapshotImage).not.toHaveBeenCalled();
    expect(screen.getByText(/screenshot permission is required/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
