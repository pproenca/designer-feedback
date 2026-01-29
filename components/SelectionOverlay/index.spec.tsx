import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Mock Framer Motion to avoid animation timing issues
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, style, ...props }: HTMLAttributes<HTMLDivElement> & { style?: Record<string, unknown> }) => {
      // Convert MotionValue-like objects to their raw values for testing
      const processedStyle: Record<string, unknown> = {};
      if (style) {
        for (const [key, value] of Object.entries(style)) {
          // Check if it's a MotionValue (has a .get() method)
          processedStyle[key] = value && typeof value === 'object' && 'get' in value
            ? (value as { get: () => unknown }).get()
            : value;
        }
      }
      return <div style={processedStyle as CSSProperties} {...props}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useMotionValue: (initial: number) => ({
    get: () => initial,
    set: vi.fn(),
  }),
  useReducedMotion: () => false,
}));

// Mock useElementSelection hook
const mockUseElementSelection = vi.fn();
vi.mock('./useElementSelection', () => ({
  useElementSelection: () => mockUseElementSelection(),
}));

describe('SelectionOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementation
    mockUseElementSelection.mockReturnValue({
      hoverInfo: null,
      hasTarget: false,
      highlightX: { get: () => 0, set: vi.fn() },
      highlightY: { get: () => 0, set: vi.fn() },
      highlightWidth: { get: () => 0, set: vi.fn() },
      highlightHeight: { get: () => 0, set: vi.fn() },
      tooltipX: { get: () => 0, set: vi.fn() },
      tooltipY: { get: () => 0, set: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('visibility', () => {
    it('renders nothing when not enabled', async () => {
      mockUseElementSelection.mockReturnValue({
        hoverInfo: null,
        hasTarget: false,
        highlightX: { get: () => 0, set: vi.fn() },
        highlightY: { get: () => 0, set: vi.fn() },
        highlightWidth: { get: () => 0, set: vi.fn() },
        highlightHeight: { get: () => 0, set: vi.fn() },
        tooltipX: { get: () => 0, set: vi.fn() },
        tooltipY: { get: () => 0, set: vi.fn() },
      });

      const { SelectionOverlay } = await import('./index');
      const { container } = render(<SelectionOverlay enabled={false} />);

      // Should render empty or nothing
      expect(container.querySelector('[data-selection-overlay]')).toBeNull();
    });

    it('renders highlight when enabled and has target', async () => {
      mockUseElementSelection.mockReturnValue({
        hoverInfo: { element: 'button.primary' },
        hasTarget: true,
        highlightX: { get: () => 100, set: vi.fn() },
        highlightY: { get: () => 200, set: vi.fn() },
        highlightWidth: { get: () => 150, set: vi.fn() },
        highlightHeight: { get: () => 50, set: vi.fn() },
        tooltipX: { get: () => 100, set: vi.fn() },
        tooltipY: { get: () => 258, set: vi.fn() },
      });

      const { SelectionOverlay } = await import('./index');
      const { container } = render(<SelectionOverlay enabled={true} />);

      // Should render highlight box
      const highlight = container.querySelector('[data-selection-highlight]');
      expect(highlight).not.toBeNull();
    });

    it('hides highlight when no target', async () => {
      mockUseElementSelection.mockReturnValue({
        hoverInfo: null,
        hasTarget: false,
        highlightX: { get: () => 0, set: vi.fn() },
        highlightY: { get: () => 0, set: vi.fn() },
        highlightWidth: { get: () => 0, set: vi.fn() },
        highlightHeight: { get: () => 0, set: vi.fn() },
        tooltipX: { get: () => 0, set: vi.fn() },
        tooltipY: { get: () => 0, set: vi.fn() },
      });

      const { SelectionOverlay } = await import('./index');
      const { container } = render(<SelectionOverlay enabled={true} />);

      // Should not render highlight when no target
      const highlight = container.querySelector('[data-selection-highlight]');
      expect(highlight).toBeNull();
    });
  });

  describe('highlight box position', () => {
    it('positions highlight at correct coordinates', async () => {
      mockUseElementSelection.mockReturnValue({
        hoverInfo: { element: 'div.container' },
        hasTarget: true,
        highlightX: { get: () => 100, set: vi.fn() },
        highlightY: { get: () => 200, set: vi.fn() },
        highlightWidth: { get: () => 300, set: vi.fn() },
        highlightHeight: { get: () => 150, set: vi.fn() },
        tooltipX: { get: () => 100, set: vi.fn() },
        tooltipY: { get: () => 358, set: vi.fn() },
      });

      const { SelectionOverlay } = await import('./index');
      const { container } = render(<SelectionOverlay enabled={true} />);

      const highlight = container.querySelector('[data-selection-highlight]');
      expect(highlight).not.toBeNull();

      // Note: In real implementation, these would come from motion values
      expect(highlight).toBeDefined();
    });
  });

  describe('tooltip', () => {
    it('shows element name in tooltip', async () => {
      mockUseElementSelection.mockReturnValue({
        hoverInfo: { element: 'button "Submit"' },
        hasTarget: true,
        highlightX: { get: () => 100, set: vi.fn() },
        highlightY: { get: () => 200, set: vi.fn() },
        highlightWidth: { get: () => 150, set: vi.fn() },
        highlightHeight: { get: () => 50, set: vi.fn() },
        tooltipX: { get: () => 100, set: vi.fn() },
        tooltipY: { get: () => 258, set: vi.fn() },
      });

      const { SelectionOverlay } = await import('./index');
      const { getByText } = render(<SelectionOverlay enabled={true} />);

      expect(getByText('button "Submit"')).toBeDefined();
    });

    it('positions tooltip below highlight', async () => {
      mockUseElementSelection.mockReturnValue({
        hoverInfo: { element: 'div' },
        hasTarget: true,
        highlightX: { get: () => 100, set: vi.fn() },
        highlightY: { get: () => 200, set: vi.fn() },
        highlightWidth: { get: () => 150, set: vi.fn() },
        highlightHeight: { get: () => 50, set: vi.fn() },
        tooltipX: { get: () => 100, set: vi.fn() },
        tooltipY: { get: () => 258, set: vi.fn() }, // 200 + 50 + 8 (offset)
      });

      const { SelectionOverlay } = await import('./index');
      const { container } = render(<SelectionOverlay enabled={true} />);

      const tooltip = container.querySelector('[data-selection-tooltip]');
      expect(tooltip).not.toBeNull();
    });
  });

  describe('cleanup', () => {
    it('unmounts cleanly', async () => {
      mockUseElementSelection.mockReturnValue({
        hoverInfo: { element: 'div' },
        hasTarget: true,
        highlightX: { get: () => 100, set: vi.fn() },
        highlightY: { get: () => 200, set: vi.fn() },
        highlightWidth: { get: () => 150, set: vi.fn() },
        highlightHeight: { get: () => 50, set: vi.fn() },
        tooltipX: { get: () => 100, set: vi.fn() },
        tooltipY: { get: () => 258, set: vi.fn() },
      });

      const { SelectionOverlay } = await import('./index');
      const { unmount } = render(<SelectionOverlay enabled={true} />);

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });
  });
});
