// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useMarkerDrag} from './useMarkerDrag';
import type {Annotation} from '@/types';

const createMockAnnotation = (
  overrides: Partial<Annotation> = {}
): Annotation => ({
  id: 'test-1',
  x: 100,
  y: 200,
  comment: 'Test comment',
  category: 'bug',
  element: 'div',
  elementPath: 'body > div',
  timestamp: Date.now(),
  isFixed: false,
  boundingBox: {x: 50, y: 150, width: 100, height: 50},
  ...overrides,
});

describe('useMarkerDrag', () => {
  const THRESHOLD = 5;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {value: 1024, writable: true});
    Object.defineProperty(window, 'innerHeight', {value: 768, writable: true});
    Object.defineProperty(window, 'scrollX', {value: 0, writable: true});
    Object.defineProperty(window, 'scrollY', {value: 0, writable: true});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should not be dragging initially', () => {
      const {result} = renderHook(() => useMarkerDrag());
      expect(result.current.isDragging).toBe(false);
    });

    it('should have null draggedAnnotationId initially', () => {
      const {result} = renderHook(() => useMarkerDrag());
      expect(result.current.draggedAnnotationId).toBeNull();
    });

    it('should have null currentDragPosition initially', () => {
      const {result} = renderHook(() => useMarkerDrag());
      expect(result.current.currentDragPosition).toBeNull();
    });
  });

  describe('getMarkerHandlers', () => {
    it('should return handlers object with onMouseDown', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      expect(handlers).toHaveProperty('onMouseDown');
      expect(typeof handlers.onMouseDown).toBe('function');
    });
  });

  describe('drag threshold', () => {
    it('should not start dragging until movement exceeds threshold', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      // Simulate mousedown
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Simulate small movement (under threshold)
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 102,
          clientY: 202,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedAnnotationId).toBeNull();
    });

    it('should start dragging when movement exceeds threshold', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      // Simulate mousedown
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Simulate movement exceeding threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 100 + THRESHOLD + 1,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.draggedAnnotationId).toBe('test-1');
    });
  });

  describe('coordinate systems', () => {
    it('should use viewport coordinates for fixed markers', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation({
        isFixed: true,
        x: 100,
        y: 200,
        boundingBox: undefined,
      });
      const handlers = result.current.getMarkerHandlers(annotation);

      // Set scroll position
      Object.defineProperty(window, 'scrollX', {value: 500, writable: true});
      Object.defineProperty(window, 'scrollY', {value: 300, writable: true});

      // Simulate mousedown
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold - move by 50px in x
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 150,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      // For fixed markers, position should be based on clientX/Y only
      // Original position: x=100, moved by 50px = 150
      expect(result.current.currentDragPosition?.x).toBe(150);
      expect(result.current.currentDragPosition?.y).toBe(200);
    });

    it('should use document coordinates for absolute markers', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation({
        isFixed: false,
        x: 100,
        y: 200,
        boundingBox: undefined,
      });
      const handlers = result.current.getMarkerHandlers(annotation);

      // Set scroll position
      Object.defineProperty(window, 'scrollX', {value: 500, writable: true});
      Object.defineProperty(window, 'scrollY', {value: 300, writable: true});

      // Simulate mousedown - clientX/Y are viewport coords
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold - move by 50px in x
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 150,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      // For absolute markers, position should include scroll offset
      // Original position: x=100, moved by 50px = 150, but we need to add scrollX
      // However, the delta calculation is: newClientX - startClientX + startPosition
      // = 150 - 100 + 100 = 150 (the start position is already in document coords)
      expect(result.current.currentDragPosition?.x).toBe(150);
      expect(result.current.currentDragPosition?.y).toBe(200);
    });
  });

  describe('bounding box constraints', () => {
    it('clamps drag position within bounding box for absolute markers', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation({
        isFixed: false,
        x: 100,
        y: 200,
        boundingBox: {x: 50, y: 150, width: 100, height: 50},
      });
      const handlers = result.current.getMarkerHandlers(annotation);

      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 400,
          clientY: 500,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.currentDragPosition?.x).toBe(150);
      expect(result.current.currentDragPosition?.y).toBe(200);
    });

    it('clamps fixed marker drag position using viewport bounds', () => {
      Object.defineProperty(window, 'scrollX', {value: 500, writable: true});
      Object.defineProperty(window, 'scrollY', {value: 300, writable: true});

      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation({
        isFixed: true,
        x: 100,
        y: 100,
        boundingBox: {x: 550, y: 380, width: 100, height: 60},
      });
      const handlers = result.current.getMarkerHandlers(annotation);

      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 100,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 300,
          clientY: 300,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.currentDragPosition?.x).toBe(150);
      expect(result.current.currentDragPosition?.y).toBe(140);
    });
  });

  describe('click vs drag callbacks', () => {
    it('should call onClick when no drag occurred (click)', () => {
      const onClick = vi.fn();
      const onDragEnd = vi.fn();
      const {result} = renderHook(() => useMarkerDrag({onClick, onDragEnd}));
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      // Simulate mousedown
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Small movement (under threshold)
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 101,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      // Release mouse
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(onClick).toHaveBeenCalledWith('test-1');
      expect(onDragEnd).not.toHaveBeenCalled();
    });

    it('should call onDragEnd when drag completed', () => {
      const onClick = vi.fn();
      const onDragEnd = vi.fn();
      const {result} = renderHook(() => useMarkerDrag({onClick, onDragEnd}));
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      // Simulate mousedown
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 150,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      // Release mouse
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(onDragEnd).toHaveBeenCalledWith('test-1', {x: 150, y: 200});
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('drag state management', () => {
    it('should set isDragging to false on mouseup', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      // Start dragging
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 200,
          clientY: 300,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(true);

      // Release mouse
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedAnnotationId).toBeNull();
      expect(result.current.currentDragPosition).toBeNull();
    });

    it('should track the correct annotation id during drag', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation1 = createMockAnnotation({id: 'annotation-1'});
      const annotation2 = createMockAnnotation({id: 'annotation-2'});

      const handlers1 = result.current.getMarkerHandlers(annotation1);

      // Start dragging annotation 1
      act(() => {
        handlers1.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 150,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.draggedAnnotationId).toBe('annotation-1');

      // Release
      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });

      // Now drag annotation 2
      const handlers2 = result.current.getMarkerHandlers(annotation2);

      act(() => {
        handlers2.onMouseDown({
          button: 0,
          clientX: 300,
          clientY: 400,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 350,
          clientY: 400,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.draggedAnnotationId).toBe('annotation-2');
    });
  });

  describe('disabled state', () => {
    it('should not start drag when disabled', () => {
      const {result} = renderHook(() => useMarkerDrag({disabled: true}));
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      // Simulate mousedown
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 200,
          clientY: 300,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.draggedAnnotationId).toBeNull();
    });
  });

  describe('draggedAnnotation', () => {
    it('should return the annotation being dragged', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation({id: 'test-drag'});
      const handlers = result.current.getMarkerHandlers(annotation);

      // Simulate mousedown
      act(() => {
        handlers.onMouseDown({
          button: 0,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 150,
          clientY: 200,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.draggedAnnotation?.id).toBe('test-drag');
      expect(result.current.draggedAnnotation?.boundingBox).toEqual({
        x: 50,
        y: 150,
        width: 100,
        height: 50,
      });
    });

    it('should return null when not dragging', () => {
      const {result} = renderHook(() => useMarkerDrag());
      expect(result.current.draggedAnnotation).toBeNull();
    });
  });

  describe('mouse button handling', () => {
    it('should only handle left mouse button', () => {
      const {result} = renderHook(() => useMarkerDrag());
      const annotation = createMockAnnotation();
      const handlers = result.current.getMarkerHandlers(annotation);

      // Simulate right-click
      act(() => {
        handlers.onMouseDown({
          button: 2,
          clientX: 100,
          clientY: 200,
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        } as unknown as React.MouseEvent);
      });

      // Move past threshold
      act(() => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 200,
          clientY: 300,
        });
        window.dispatchEvent(mouseMoveEvent);
      });

      expect(result.current.isDragging).toBe(false);
    });
  });
});
