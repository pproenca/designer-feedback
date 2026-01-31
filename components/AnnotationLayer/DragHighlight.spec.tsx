import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { Annotation } from '@/types';

// Mock Framer Motion to avoid animation timing issues
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, style, ...props }: HTMLAttributes<HTMLDivElement> & { style?: Record<string, unknown> }) => {
      return <div style={style as CSSProperties} {...props}>{children}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

const createMockAnnotation = (overrides: Partial<Annotation> = {}): Annotation => ({
  id: 'test-1',
  x: 100,
  y: 200,
  comment: 'Test comment',
  category: 'bug',
  element: 'div',
  elementPath: 'body > div',
  timestamp: Date.now(),
  isFixed: false,
  boundingBox: { x: 50, y: 150, width: 100, height: 50 },
  ...overrides,
});

describe('DragHighlight', () => {
  afterEach(() => {
    cleanup();
  });

  describe('visibility', () => {
    it('renders nothing when not visible', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation();
      const { container } = render(<DragHighlight annotation={annotation} visible={false} />);

      expect(container.querySelector('[data-drag-highlight]')).toBeNull();
    });

    it('renders nothing when annotation is null', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const { container } = render(<DragHighlight annotation={null} visible={true} />);

      expect(container.querySelector('[data-drag-highlight]')).toBeNull();
    });

    it('renders nothing when annotation has no boundingBox', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation({ boundingBox: undefined });
      const { container } = render(<DragHighlight annotation={annotation} visible={true} />);

      expect(container.querySelector('[data-drag-highlight]')).toBeNull();
    });

    it('renders highlight when visible with valid annotation', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation();
      const { container } = render(<DragHighlight annotation={annotation} visible={true} />);

      expect(container.querySelector('[data-drag-highlight]')).not.toBeNull();
    });
  });

  describe('position', () => {
    it('positions highlight at boundingBox coordinates for absolute markers', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation({
        isFixed: false,
        boundingBox: { x: 100, y: 200, width: 150, height: 75 },
      });
      const { container } = render(<DragHighlight annotation={annotation} visible={true} />);

      const highlight = container.querySelector('[data-drag-highlight]') as HTMLElement;
      expect(highlight).not.toBeNull();

      // Check inline styles for position
      expect(highlight.style.left).toBe('100px');
      expect(highlight.style.top).toBe('200px');
      expect(highlight.style.width).toBe('150px');
      expect(highlight.style.height).toBe('75px');
    });

    it('uses fixed position for fixed markers', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation({ isFixed: true });
      const { container } = render(<DragHighlight annotation={annotation} visible={true} />);

      const highlight = container.querySelector('[data-drag-highlight]') as HTMLElement;
      expect(highlight).not.toBeNull();

      // Should have fixed class
      expect(highlight.className).toContain('fixed');
    });

    it('uses absolute position for absolute markers', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation({ isFixed: false });
      const { container } = render(<DragHighlight annotation={annotation} visible={true} />);

      const highlight = container.querySelector('[data-drag-highlight]') as HTMLElement;
      expect(highlight).not.toBeNull();

      // Should have absolute class
      expect(highlight.className).toContain('absolute');
    });
  });

  describe('styling', () => {
    it('has dashed border styling', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation();
      const { container } = render(<DragHighlight annotation={annotation} visible={true} />);

      const highlight = container.querySelector('[data-drag-highlight]') as HTMLElement;
      expect(highlight).not.toBeNull();

      // Should have border classes
      expect(highlight.className).toContain('border-2');
      expect(highlight.className).toContain('border-dashed');
    });

    it('is pointer-events-none', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation();
      const { container } = render(<DragHighlight annotation={annotation} visible={true} />);

      const highlight = container.querySelector('[data-drag-highlight]') as HTMLElement;
      expect(highlight).not.toBeNull();

      expect(highlight.className).toContain('pointer-events-none');
    });
  });

  describe('cleanup', () => {
    it('unmounts cleanly', async () => {
      const { DragHighlight } = await import('./DragHighlight');
      const annotation = createMockAnnotation();
      const { unmount } = render(<DragHighlight annotation={annotation} visible={true} />);

      expect(() => unmount()).not.toThrow();
    });
  });
});
