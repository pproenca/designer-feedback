import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Annotation } from '@/types';

// Mock Framer Motion - filter out non-DOM props to avoid React warnings
const filterMotionProps = (props: Record<string, unknown>) => {
  const motionProps = ['initial', 'animate', 'exit', 'variants', 'transition', 'whileHover', 'whileTap', 'whileFocus', 'whileDrag', 'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete'];
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!motionProps.includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
};

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, style, ...props }: HTMLAttributes<HTMLDivElement> & { style?: CSSProperties }) => (
      <div style={style} {...filterMotionProps(props)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

const createMockAnnotation = (overrides: Partial<Annotation> = {}): Annotation => ({
  id: `annotation-${Math.random().toString(36).slice(2)}`,
  x: 100,
  y: 200,
  comment: 'Test comment',
  category: 'suggestion',
  element: 'div',
  elementPath: 'body > div',
  timestamp: Date.now(),
  isFixed: false,
  ...overrides,
});

describe('MarkerLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders nothing when annotations array is empty', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const { container } = render(
        <MarkerLayer
          annotations={[]}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      expect(container.querySelectorAll('[data-annotation-marker]').length).toBe(0);
    });

    it('renders markers for each annotation', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [
        createMockAnnotation({ id: '1' }),
        createMockAnnotation({ id: '2' }),
        createMockAnnotation({ id: '3' }),
      ];

      const { container } = render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      expect(container.querySelectorAll('[data-annotation-marker]').length).toBe(3);
    });

    it('displays correct marker numbers', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [
        createMockAnnotation({ id: '1' }),
        createMockAnnotation({ id: '2' }),
      ];

      render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      expect(screen.getByText('1')).toBeDefined();
      expect(screen.getByText('2')).toBeDefined();
    });
  });

  describe('positioning', () => {
    it('uses absolute positioning for non-fixed annotations', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [
        createMockAnnotation({ x: 500, y: 300, isFixed: false }),
      ];

      const { container } = render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      // Absolute markers should be in the absolute container
      const absoluteContainer = container.querySelector('.absolute');
      expect(absoluteContainer?.querySelector('[data-annotation-marker]')).not.toBeNull();
    });

    it('uses fixed positioning for fixed annotations', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [
        createMockAnnotation({ x: 100, y: 50, isFixed: true }),
      ];

      const { container } = render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      // Fixed markers should be in the fixed container
      const fixedContainer = container.querySelector('.fixed');
      expect(fixedContainer?.querySelector('[data-annotation-marker]')).not.toBeNull();
    });

    it('separates fixed and absolute markers into different containers', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [
        createMockAnnotation({ id: '1', isFixed: false }),
        createMockAnnotation({ id: '2', isFixed: true }),
        createMockAnnotation({ id: '3', isFixed: false }),
      ];

      const { container } = render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      const markers = container.querySelectorAll('[data-annotation-marker]');
      expect(markers.length).toBe(3);
    });
  });

  describe('interactions', () => {
    it('calls onMarkerClick when marker is clicked', async () => {
      const onMarkerClick = vi.fn();
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [createMockAnnotation({ id: 'test-id' })];

      render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={onMarkerClick}
        />
      );

      fireEvent.click(screen.getByText('1'));
      expect(onMarkerClick).toHaveBeenCalledWith('test-id');
    });

    it('calls onMarkerClick with correct id for each marker', async () => {
      const onMarkerClick = vi.fn();
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [
        createMockAnnotation({ id: 'first' }),
        createMockAnnotation({ id: 'second' }),
      ];

      render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={onMarkerClick}
        />
      );

      fireEvent.click(screen.getByText('2'));
      expect(onMarkerClick).toHaveBeenCalledWith('second');
    });

    it('supports keyboard activation with Enter', async () => {
      const onMarkerClick = vi.fn();
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [createMockAnnotation({ id: 'test-id' })];

      render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={onMarkerClick}
        />
      );

      const marker = screen.getByText('1');
      fireEvent.keyDown(marker, { key: 'Enter' });
      expect(onMarkerClick).toHaveBeenCalledWith('test-id');
    });

    it('supports keyboard activation with Space', async () => {
      const onMarkerClick = vi.fn();
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [createMockAnnotation({ id: 'test-id' })];

      render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={onMarkerClick}
        />
      );

      const marker = screen.getByText('1');
      fireEvent.keyDown(marker, { key: ' ' });
      expect(onMarkerClick).toHaveBeenCalledWith('test-id');
    });
  });

  describe('accessibility', () => {
    it('has button role on markers', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [createMockAnnotation()];

      render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      expect(screen.getByRole('button')).toBeDefined();
    });

    it('has tabIndex 0 for keyboard navigation', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [createMockAnnotation()];

      const { container } = render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      const marker = container.querySelector('[data-annotation-marker]');
      expect(marker?.getAttribute('tabindex')).toBe('0');
    });

    it('has appropriate aria-label', async () => {
      const { MarkerLayer } = await import('./MarkerLayer');
      const annotations = [createMockAnnotation({ category: 'bug' })];

      render(
        <MarkerLayer
          annotations={annotations}
          isEntranceComplete={true}
          onMarkerClick={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /annotation 1.*bug/i })).toBeDefined();
    });
  });

});
