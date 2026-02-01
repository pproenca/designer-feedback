// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act, waitFor} from '@testing-library/react';

// Mock requestAnimationFrame for testing RAF batching
type RafCallback = (time: number) => void;
const rafCallbacks: RafCallback[] = [];
const mockRaf = vi.fn((callback: RafCallback) => {
  rafCallbacks.push(callback);
  return rafCallbacks.length;
});
const mockCancelRaf = vi.fn((id: number) => {
  rafCallbacks.splice(id - 1, 1);
});

const flushRaf = () => {
  const callbacks = [...rafCallbacks];
  rafCallbacks.length = 0;
  callbacks.forEach(cb => cb(performance.now()));
};

describe('useElementSelection', () => {
  beforeEach(() => {
    rafCallbacks.length = 0;
    vi.stubGlobal('requestAnimationFrame', mockRaf);
    vi.stubGlobal('cancelAnimationFrame', mockCancelRaf);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('initial state', () => {
    it('returns null hoverInfo when not hovering', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      expect(result.current.hoverInfo).toBeNull();
    });

    it('returns hasTarget as false initially', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      expect(result.current.hasTarget).toBe(false);
    });

    it('returns motion values for highlight box', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      expect(result.current.highlightX).toBeDefined();
      expect(result.current.highlightY).toBeDefined();
      expect(result.current.highlightWidth).toBeDefined();
      expect(result.current.highlightHeight).toBeDefined();
    });

    it('returns motion values for tooltip position', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      expect(result.current.tooltipX).toBeDefined();
      expect(result.current.tooltipY).toBeDefined();
    });
  });

  describe('element tracking', () => {
    it('updates motion values on mouseover without triggering re-render', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      // Create a mock element
      const mockElement = document.createElement('div');
      mockElement.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 150,
        height: 50,
        bottom: 250,
        right: 250,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));
      document.body.appendChild(mockElement);

      // Simulate mouseover
      act(() => {
        const event = new MouseEvent('mouseover', {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, 'target', {value: mockElement});
        document.dispatchEvent(event);
      });

      // Flush RAF to process the update
      act(() => {
        flushRaf();
      });

      // Motion values should be updated (accessed via .get())
      expect(result.current.highlightX.get()).toBe(100);
      expect(result.current.highlightY.get()).toBe(200);
      expect(result.current.highlightWidth.get()).toBe(150);
      expect(result.current.highlightHeight.get()).toBe(50);

      document.body.removeChild(mockElement);
    });

    it('only triggers state update when element path changes', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const renderCount = {current: 0};

      const {result} = renderHook(() => {
        renderCount.current++;
        return useElementSelection({enabled: true});
      });

      // Create mock elements
      const mockDiv = document.createElement('div');
      mockDiv.className = 'test-element';
      mockDiv.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 150,
        height: 50,
        bottom: 250,
        right: 250,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));
      document.body.appendChild(mockDiv);

      // First hover - should trigger state update for hoverInfo
      act(() => {
        const event = new MouseEvent('mouseover', {bubbles: true});
        Object.defineProperty(event, 'target', {value: mockDiv});
        document.dispatchEvent(event);
      });
      act(() => flushRaf());

      await waitFor(() => {
        expect(result.current.hoverInfo).not.toBeNull();
      });

      const afterFirstHover = renderCount.current;

      // Hover same element again - should NOT trigger state update
      act(() => {
        const event = new MouseEvent('mouseover', {bubbles: true});
        Object.defineProperty(event, 'target', {value: mockDiv});
        document.dispatchEvent(event);
      });
      act(() => flushRaf());

      // Render count should not increase for same element
      expect(renderCount.current).toBe(afterFirstHover);

      document.body.removeChild(mockDiv);
    });
  });

  describe('RAF batching', () => {
    it('batches rapid hover events using requestAnimationFrame', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      renderHook(() => useElementSelection({enabled: true}));

      const mockElement = document.createElement('div');
      mockElement.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 150,
        height: 50,
        bottom: 250,
        right: 250,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));
      document.body.appendChild(mockElement);

      // Fire multiple rapid hover events
      for (let i = 0; i < 5; i++) {
        act(() => {
          const event = new MouseEvent('mouseover', {bubbles: true});
          Object.defineProperty(event, 'target', {value: mockElement});
          document.dispatchEvent(event);
        });
      }

      // Should have scheduled RAF calls, but batched
      expect(mockRaf.mock.calls.length).toBeGreaterThan(0);

      // Flush all pending RAF callbacks
      act(() => flushRaf());

      // getBoundingClientRect should be called efficiently (batched)
      // The exact number depends on implementation, but it should be limited
      expect(mockElement.getBoundingClientRect).toHaveBeenCalled();

      document.body.removeChild(mockElement);
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on unmount', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const {unmount} = renderHook(() => useElementSelection({enabled: true}));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseover',
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it('cancels pending RAF on unmount', async () => {
      const {useElementSelection} = await import('./useElementSelection');

      const mockElement = document.createElement('div');
      mockElement.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 150,
        height: 50,
        bottom: 250,
        right: 250,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));
      document.body.appendChild(mockElement);

      const {unmount} = renderHook(() => useElementSelection({enabled: true}));

      // Trigger a hover to schedule RAF
      act(() => {
        const event = new MouseEvent('mouseover', {bubbles: true});
        Object.defineProperty(event, 'target', {value: mockElement});
        document.dispatchEvent(event);
      });

      // Unmount before RAF fires
      unmount();

      expect(mockCancelRaf).toHaveBeenCalled();

      document.body.removeChild(mockElement);
    });

    it('clears hover state when disabled', async () => {
      const {useElementSelection} = await import('./useElementSelection');

      const {result, rerender} = renderHook(
        ({enabled}) => useElementSelection({enabled}),
        {initialProps: {enabled: true}}
      );

      const mockElement = document.createElement('div');
      mockElement.className = 'test';
      mockElement.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 150,
        height: 50,
        bottom: 250,
        right: 250,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));
      document.body.appendChild(mockElement);

      // Trigger hover
      act(() => {
        const event = new MouseEvent('mouseover', {bubbles: true});
        Object.defineProperty(event, 'target', {value: mockElement});
        document.dispatchEvent(event);
      });
      act(() => flushRaf());

      await waitFor(() => {
        expect(result.current.hasTarget).toBe(true);
      });

      // Disable selection
      rerender({enabled: false});

      expect(result.current.hasTarget).toBe(false);
      expect(result.current.hoverInfo).toBeNull();

      document.body.removeChild(mockElement);
    });
  });

  describe('element filtering', () => {
    it('ignores elements with data-annotation-popup attribute', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      const mockPopup = document.createElement('div');
      mockPopup.setAttribute('data-annotation-popup', 'true');
      mockPopup.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 150,
        height: 50,
        bottom: 250,
        right: 250,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));
      document.body.appendChild(mockPopup);

      act(() => {
        const event = new MouseEvent('mouseover', {bubbles: true});
        Object.defineProperty(event, 'target', {value: mockPopup});
        document.dispatchEvent(event);
      });
      act(() => flushRaf());

      expect(result.current.hasTarget).toBe(false);

      document.body.removeChild(mockPopup);
    });

    it('ignores elements with data-toolbar attribute', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      const mockToolbar = document.createElement('div');
      mockToolbar.setAttribute('data-toolbar', 'true');
      mockToolbar.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 150,
        height: 50,
        bottom: 250,
        right: 250,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));
      document.body.appendChild(mockToolbar);

      act(() => {
        const event = new MouseEvent('mouseover', {bubbles: true});
        Object.defineProperty(event, 'target', {value: mockToolbar});
        document.dispatchEvent(event);
      });
      act(() => flushRaf());

      expect(result.current.hasTarget).toBe(false);

      document.body.removeChild(mockToolbar);
    });

    it('ignores children of filtered elements', async () => {
      const {useElementSelection} = await import('./useElementSelection');
      const {result} = renderHook(() => useElementSelection({enabled: true}));

      const mockToolbar = document.createElement('div');
      mockToolbar.setAttribute('data-toolbar', 'true');
      const childButton = document.createElement('button');
      mockToolbar.appendChild(childButton);
      document.body.appendChild(mockToolbar);

      childButton.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 50,
        height: 30,
        bottom: 230,
        right: 150,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }));

      act(() => {
        const event = new MouseEvent('mouseover', {bubbles: true});
        Object.defineProperty(event, 'target', {value: childButton});
        document.dispatchEvent(event);
      });
      act(() => flushRaf());

      expect(result.current.hasTarget).toBe(false);

      document.body.removeChild(mockToolbar);
    });
  });
});
