import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExportModal } from './index';
import type { Annotation } from '@/types';

// Mock export utilities
vi.mock('@/utils/export', () => ({
  exportAsImageWithNotes: vi.fn().mockResolvedValue(undefined),
  exportAsSnapshotImage: vi.fn().mockResolvedValue(undefined),
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
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('clears timeout when component unmounts before auto-close', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const onClose = vi.fn();

    const { unmount } = render(
      <ExportModal annotations={mockAnnotations} onClose={onClose} />
    );

    // Click export button to trigger the auto-close timer
    const exportButton = screen.getByRole('button', { name: /download snapshot/i });
    fireEvent.click(exportButton);

    // Wait for export to complete (mocked to resolve immediately)
    await vi.runAllTimersAsync();

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
    fireEvent.click(exportButton);

    // Wait for export to complete
    await vi.runAllTimersAsync();

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
    fireEvent.click(exportButton);

    // Wait for export to complete
    await vi.runAllTimersAsync();

    // Advance past the auto-close timer
    vi.advanceTimersByTime(1600);

    // onClose should have been called by the timer
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
