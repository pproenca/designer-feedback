import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, style, ...props }: HTMLAttributes<HTMLDivElement> & {
      style?: CSSProperties;
    }) => <div style={style} {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

describe('PendingMarker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders nothing when pendingAnnotation is null', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const { container } = render(
        <PendingMarker pendingAnnotation={null} markerNumber={1} />
      );

      expect(container.querySelector('[data-pending-marker]')).toBeNull();
    });

    it('renders marker when pendingAnnotation is provided', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const pendingAnnotation = {
        x: 100,
        y: 200,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(80, 185, 40, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const { container } = render(
        <PendingMarker pendingAnnotation={pendingAnnotation} markerNumber={5} />
      );

      expect(container.querySelector('[data-pending-marker]')).not.toBeNull();
    });

    it('displays the marker number', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const pendingAnnotation = {
        x: 100,
        y: 200,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(80, 185, 40, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      render(<PendingMarker pendingAnnotation={pendingAnnotation} markerNumber={3} />);

      expect(screen.getByText('3')).toBeDefined();
    });
  });

  describe('positioning', () => {
    it('uses absolute positioning for non-fixed elements', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const pendingAnnotation = {
        x: 500,
        y: 300,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(475, 285, 50, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const { container } = render(
        <PendingMarker pendingAnnotation={pendingAnnotation} markerNumber={1} />
      );

      const marker = container.querySelector('[data-pending-marker]') as HTMLElement;
      expect(marker.style.position).toBe('absolute');
    });

    it('uses fixed positioning for fixed elements', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const pendingAnnotation = {
        x: 100,
        y: 50,
        element: 'nav',
        elementPath: 'body > nav',
        target: document.createElement('nav'),
        rect: new DOMRect(75, 35, 50, 30),
        isFixed: true,
        scrollX: 0,
        scrollY: 500,
      };

      const { container } = render(
        <PendingMarker pendingAnnotation={pendingAnnotation} markerNumber={1} />
      );

      const marker = container.querySelector('[data-pending-marker]') as HTMLElement;
      expect(marker.style.position).toBe('fixed');
    });

    it('positions marker at pending annotation coordinates', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const pendingAnnotation = {
        x: 250,
        y: 400,
        element: 'button',
        elementPath: 'body > div > button',
        target: document.createElement('button'),
        rect: new DOMRect(225, 385, 50, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const { container } = render(
        <PendingMarker pendingAnnotation={pendingAnnotation} markerNumber={1} />
      );

      const marker = container.querySelector('[data-pending-marker]') as HTMLElement;
      expect(marker.style.left).toBe('250px');
    });

    it('calculates y position using rect for fixed elements', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const pendingAnnotation = {
        x: 100,
        y: 50, // This is viewport-relative
        element: 'nav',
        elementPath: 'body > nav',
        target: document.createElement('nav'),
        rect: new DOMRect(75, 35, 50, 30), // top: 35, height: 30 -> center at 50
        isFixed: true,
        scrollX: 0,
        scrollY: 500,
      };

      const { container } = render(
        <PendingMarker pendingAnnotation={pendingAnnotation} markerNumber={1} />
      );

      const marker = container.querySelector('[data-pending-marker]') as HTMLElement;
      // For fixed elements, y should be rect.top + rect.height/2
      expect(marker.style.top).toBe('50px');
    });
  });

  describe('styling', () => {
    it('has correct marker styles (rounded, centered)', async () => {
      const { PendingMarker } = await import('./PendingMarker');
      const pendingAnnotation = {
        x: 100,
        y: 200,
        element: 'div',
        elementPath: 'body > div',
        target: document.createElement('div'),
        rect: new DOMRect(80, 185, 40, 30),
        isFixed: false,
        scrollX: 0,
        scrollY: 0,
      };

      const { container } = render(
        <PendingMarker pendingAnnotation={pendingAnnotation} markerNumber={1} />
      );

      const marker = container.querySelector('[data-pending-marker]');
      expect(marker).not.toBeNull();
      // Marker should have translate to center it
      expect(marker?.className).toContain('-translate-x-1/2');
      expect(marker?.className).toContain('-translate-y-1/2');
    });
  });
});
