import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('usePopupPosition', () => {
  const mockViewport = {
    width: 1024,
    height: 768,
  };

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: mockViewport.width,
      writable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: mockViewport.height,
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial positioning', () => {
    it('returns adjusted position based on initial x, y', async () => {
      const { usePopupPosition } = await import('./usePopupPosition');
      const { result } = renderHook(() =>
        usePopupPosition({
          x: 500,
          y: 300,
          isFixed: false,
        })
      );

      expect(result.current.x).toBeDefined();
      expect(result.current.y).toBeDefined();
    });

    it('returns isFixed flag from input', async () => {
      const { usePopupPosition } = await import('./usePopupPosition');

      const { result: fixedResult } = renderHook(() =>
        usePopupPosition({ x: 100, y: 100, isFixed: true })
      );
      expect(fixedResult.current.isFixed).toBe(true);

      const { result: absoluteResult } = renderHook(() =>
        usePopupPosition({ x: 100, y: 100, isFixed: false })
      );
      expect(absoluteResult.current.isFixed).toBe(false);
    });
  });

  describe('viewport clamping', () => {
    it('clamps popup to left edge when x would position popup off-screen', async () => {
      const { usePopupPosition } = await import('./usePopupPosition');
      const { result } = renderHook(() =>
        usePopupPosition({
          x: 50, // Too close to left edge
          y: 300,
          isFixed: false,
        })
      );

      // Popup should be moved right to stay on screen
      // At minimum, popup should be at least at PADDING from left edge
      expect(result.current.x).toBeGreaterThanOrEqual(0);
    });

    it('clamps popup to right edge when x would overflow', async () => {
      const { usePopupPosition, POPUP_WIDTH, POPUP_PADDING } = await import(
        './usePopupPosition'
      );
      const { result } = renderHook(() =>
        usePopupPosition({
          x: mockViewport.width - 50, // Too close to right edge
          y: 300,
          isFixed: false,
        })
      );

      // Popup should be clamped to stay within viewport
      const maxX = mockViewport.width - POPUP_WIDTH / 2 - POPUP_PADDING;
      expect(result.current.x).toBeLessThanOrEqual(maxX);
    });

    it('clamps popup to top when y is too high', async () => {
      const { usePopupPosition, POPUP_PADDING } = await import('./usePopupPosition');
      const { result } = renderHook(() =>
        usePopupPosition({
          x: 500,
          y: 10, // Too close to top
          isFixed: false,
        })
      );

      // Popup should stay within top boundary
      expect(result.current.y).toBeGreaterThanOrEqual(POPUP_PADDING);
    });

    it('clamps popup to bottom when y would overflow viewport', async () => {
      const { usePopupPosition, POPUP_HEIGHT, POPUP_PADDING } = await import(
        './usePopupPosition'
      );
      const { result } = renderHook(() =>
        usePopupPosition({
          x: 500,
          y: mockViewport.height - 20, // Too close to bottom
          isFixed: false,
        })
      );

      // Popup should stay within bottom boundary
      const maxY = mockViewport.height - POPUP_HEIGHT - POPUP_PADDING;
      expect(result.current.y).toBeLessThanOrEqual(maxY);
    });
  });

  describe('resize handling', () => {
    it('updates position when window resizes', async () => {
      const { usePopupPosition } = await import('./usePopupPosition');
      const { result, rerender } = renderHook(
        ({ x, y }) => usePopupPosition({ x, y, isFixed: false }),
        { initialProps: { x: 900, y: 300 } }
      );

      const initialX = result.current.x;

      // Simulate window resize to smaller size
      act(() => {
        Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
        window.dispatchEvent(new Event('resize'));
      });

      // Force re-render to pick up new dimensions
      rerender({ x: 900, y: 300 });

      // Position should have adjusted for smaller viewport
      expect(result.current.x).not.toBe(initialX);
    });
  });

  describe('position updates', () => {
    it('updates position when x changes', async () => {
      const { usePopupPosition } = await import('./usePopupPosition');
      const { result, rerender } = renderHook(
        ({ x, y }) => usePopupPosition({ x, y, isFixed: false }),
        { initialProps: { x: 300, y: 300 } }
      );

      const initialX = result.current.x;

      rerender({ x: 500, y: 300 });

      expect(result.current.x).not.toBe(initialX);
    });

    it('updates position when y changes', async () => {
      const { usePopupPosition } = await import('./usePopupPosition');
      const { result, rerender } = renderHook(
        ({ x, y }) => usePopupPosition({ x, y, isFixed: false }),
        { initialProps: { x: 300, y: 300 } }
      );

      const initialY = result.current.y;

      rerender({ x: 300, y: 500 });

      expect(result.current.y).not.toBe(initialY);
    });
  });

  describe('fixed positioning', () => {
    it('handles fixed position popups correctly', async () => {
      const { usePopupPosition } = await import('./usePopupPosition');
      const { result } = renderHook(() =>
        usePopupPosition({
          x: 500,
          y: 100,
          isFixed: true,
        })
      );

      expect(result.current.isFixed).toBe(true);
      // Fixed position should still respect viewport clamping
      expect(result.current.x).toBeDefined();
      expect(result.current.y).toBeDefined();
    });
  });
});
