// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useDraggable} from './useDraggable';

describe('useDraggable', () => {
  const THRESHOLD = 5;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {value: 1024, writable: true});
    Object.defineProperty(window, 'innerHeight', {value: 768, writable: true});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return null position initially', () => {
      const {result} = renderHook(() => useDraggable());
      expect(result.current.position).toBeNull();
    });

    it('should not be dragging initially', () => {
      const {result} = renderHook(() => useDraggable());
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('drag threshold', () => {
    it('should not start dragging until movement exceeds threshold', () => {
      const {result} = renderHook(() => useDraggable());

      // Simulate mousedown
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Simulate small movement (under threshold)
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 102,
          clientY: 102,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.position).toBeNull();
    });

    it('should start dragging when movement exceeds threshold', () => {
      const {result} = renderHook(() => useDraggable());

      // Simulate mousedown
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Simulate movement exceeding threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 100 + THRESHOLD + 1,
          clientY: 100,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.position).not.toBeNull();
    });
  });

  describe('position clamping', () => {
    it('should clamp position to left viewport bound', () => {
      const {result} = renderHook(() =>
        useDraggable({elementWidth: 100, elementHeight: 44})
      );

      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Try to drag past left edge
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: -50,
          clientY: 100,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.position!.x).toBeGreaterThanOrEqual(0);
    });

    it('should clamp position to right viewport bound', () => {
      const {result} = renderHook(() =>
        useDraggable({elementWidth: 100, elementHeight: 44})
      );

      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 500,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Try to drag past right edge
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 1100,
          clientY: 100,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.position!.x).toBeLessThanOrEqual(1024 - 100);
    });

    it('should clamp position to top viewport bound', () => {
      const {result} = renderHook(() =>
        useDraggable({elementWidth: 100, elementHeight: 44})
      );

      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Try to drag past top edge
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 100,
          clientY: -50,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.position!.y).toBeGreaterThanOrEqual(0);
    });

    it('should clamp position to bottom viewport bound', () => {
      const {result} = renderHook(() =>
        useDraggable({elementWidth: 100, elementHeight: 44})
      );

      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 500,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Try to drag past bottom edge
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 100,
          clientY: 900,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.position!.y).toBeLessThanOrEqual(768 - 44);
    });
  });

  describe('isDragging state transitions', () => {
    it('should set isDragging to false on mouseup', () => {
      const {result} = renderHook(() => useDraggable());

      // Start dragging
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 200,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(true);

      // Release mouse
      act(() => {
        const mouseUpEvent = new MouseEvent('mouseup');
        window.dispatchEvent(mouseUpEvent);
      });

      expect(result.current.isDragging).toBe(false);
    });

    it('should preserve position after mouseup', () => {
      const {result} = renderHook(() => useDraggable());

      // Start dragging
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 200,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      const positionBeforeRelease = {...result.current.position};

      // Release mouse
      act(() => {
        const mouseUpEvent = new MouseEvent('mouseup');
        window.dispatchEvent(mouseUpEvent);
      });

      expect(result.current.position).toEqual(positionBeforeRelease);
    });
  });

  describe('reset', () => {
    it('should reset position to null when reset is called', () => {
      const {result} = renderHook(() => useDraggable());

      // Start dragging
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 200,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      // Release mouse
      act(() => {
        const mouseUpEvent = new MouseEvent('mouseup');
        window.dispatchEvent(mouseUpEvent);
      });

      expect(result.current.position).not.toBeNull();

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.position).toBeNull();
    });
  });

  describe('expandDirection', () => {
    it('should return "left" when position is on right side of viewport (past center)', () => {
      const {result} = renderHook(() =>
        useDraggable({elementWidth: 100, elementHeight: 44})
      );

      // Drag to right side of viewport (x > 512, which is center of 1024)
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 700,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 750,
          clientY: 100,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(result.current.expandDirection).toBe('left');
    });

    it('should return "right" when position is on left side of viewport (before center)', () => {
      const {result} = renderHook(() =>
        useDraggable({elementWidth: 100, elementHeight: 44})
      );

      // Drag to left side of viewport (x < 512)
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 150,
          clientY: 100,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(result.current.expandDirection).toBe('right');
    });

    it('should default to "left" when no position (initial state, toolbar on right)', () => {
      const {result} = renderHook(() => useDraggable());

      expect(result.current.expandDirection).toBe('left');
    });
  });

  describe('initialPosition', () => {
    it('should use provided initial position', () => {
      const {result} = renderHook(() =>
        useDraggable({
          elementWidth: 100,
          elementHeight: 44,
          initialPosition: {x: 200, y: 150},
        })
      );

      expect(result.current.position).toEqual({x: 200, y: 150});
    });

    it('should calculate expandDirection based on initial position', () => {
      // Position on left side (x=200 < center of 512)
      const {result: leftResult} = renderHook(() =>
        useDraggable({
          elementWidth: 100,
          elementHeight: 44,
          initialPosition: {x: 200, y: 150},
        })
      );

      expect(leftResult.current.expandDirection).toBe('right');

      // Position on right side (x=700 > center of 512)
      const {result: rightResult} = renderHook(() =>
        useDraggable({
          elementWidth: 100,
          elementHeight: 44,
          initialPosition: {x: 700, y: 150},
        })
      );

      expect(rightResult.current.expandDirection).toBe('left');
    });
  });

  describe('onPositionChange callback', () => {
    it('should call onPositionChange when drag ends', () => {
      const onPositionChange = vi.fn();
      const {result} = renderHook(() =>
        useDraggable({
          elementWidth: 100,
          elementHeight: 44,
          onPositionChange,
        })
      );

      // Start dragging
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 200,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      // Release mouse
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(onPositionChange).toHaveBeenCalledTimes(1);
      expect(onPositionChange).toHaveBeenCalledWith(result.current.position);
    });

    it('should not call onPositionChange if drag did not exceed threshold', () => {
      const onPositionChange = vi.fn();
      const {result} = renderHook(() =>
        useDraggable({
          elementWidth: 100,
          elementHeight: 44,
          onPositionChange,
        })
      );

      // Start dragging
      act(() => {
        result.current.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Small movement (under threshold)
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 102,
          clientY: 100,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      // Release mouse
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(onPositionChange).not.toHaveBeenCalled();
    });
  });
});
