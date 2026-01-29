import { describe, it, expect, beforeEach, vi } from 'vitest';

// Tests for position calculation utilities
// These utilities provide consistent coordinate calculations for:
// - Markers (placed at element center)
// - Popups (positioned below element with gap)

describe('calculateMarkerPosition', () => {
  beforeEach(() => {
    // Reset any window mocks
    vi.stubGlobal('scrollX', 0);
    vi.stubGlobal('scrollY', 0);
  });

  describe('for fixed elements', () => {
    it('returns viewport-relative coordinates for fixed element', async () => {
      const { calculateMarkerPosition } = await import('./annotation-position');

      const rect = { left: 100, top: 200, width: 50, height: 30 } as DOMRect;
      const result = calculateMarkerPosition({
        rect,
        scrollX: 500,
        scrollY: 1000,
        isFixed: true,
      });

      // Fixed elements use viewport coordinates (ignore scroll)
      expect(result).toEqual({
        x: 125, // left + width/2
        y: 215, // top + height/2
        isFixed: true,
      });
    });

    it('ignores scroll position for fixed elements', async () => {
      const { calculateMarkerPosition } = await import('./annotation-position');

      const rect = { left: 0, top: 0, width: 100, height: 50 } as DOMRect;
      const result = calculateMarkerPosition({
        rect,
        scrollX: 9999,
        scrollY: 9999,
        isFixed: true,
      });

      expect(result.x).toBe(50); // center of element
      expect(result.y).toBe(25);
      expect(result.isFixed).toBe(true);
    });
  });

  describe('for absolute elements', () => {
    it('returns document-relative coordinates for absolute element', async () => {
      const { calculateMarkerPosition } = await import('./annotation-position');

      const rect = { left: 100, top: 200, width: 50, height: 30 } as DOMRect;
      const result = calculateMarkerPosition({
        rect,
        scrollX: 500,
        scrollY: 1000,
        isFixed: false,
      });

      // Absolute elements add scroll to viewport coords
      expect(result).toEqual({
        x: 625, // left + scrollX + width/2
        y: 1215, // top + scrollY + height/2
        isFixed: false,
      });
    });

    it('handles zero scroll position', async () => {
      const { calculateMarkerPosition } = await import('./annotation-position');

      const rect = { left: 100, top: 200, width: 50, height: 30 } as DOMRect;
      const result = calculateMarkerPosition({
        rect,
        scrollX: 0,
        scrollY: 0,
        isFixed: false,
      });

      expect(result).toEqual({
        x: 125,
        y: 215,
        isFixed: false,
      });
    });
  });

  describe('edge cases', () => {
    it('handles elements at origin (0,0)', async () => {
      const { calculateMarkerPosition } = await import('./annotation-position');

      const rect = { left: 0, top: 0, width: 20, height: 20 } as DOMRect;
      const result = calculateMarkerPosition({
        rect,
        scrollX: 0,
        scrollY: 0,
        isFixed: false,
      });

      expect(result).toEqual({
        x: 10,
        y: 10,
        isFixed: false,
      });
    });

    it('handles large elements', async () => {
      const { calculateMarkerPosition } = await import('./annotation-position');

      const rect = { left: 0, top: 0, width: 1000, height: 800 } as DOMRect;
      const result = calculateMarkerPosition({
        rect,
        scrollX: 0,
        scrollY: 0,
        isFixed: false,
      });

      expect(result).toEqual({
        x: 500,
        y: 400,
        isFixed: false,
      });
    });
  });
});

describe('calculatePopupPosition', () => {
  describe('basic positioning', () => {
    it('positions popup below element with default gap', async () => {
      const { calculatePopupPosition } = await import('./annotation-position');

      const result = calculatePopupPosition({
        rect: { left: 100, top: 200, width: 50, height: 30, bottom: 230 } as DOMRect,
        scrollX: 0,
        scrollY: 0,
        isFixed: false,
      });

      // Default gap is 16px
      expect(result.x).toBe(125); // horizontally centered on element
      expect(result.y).toBe(246); // bottom + gap (230 + 16)
      expect(result.isFixed).toBe(false);
    });

    it('uses custom gap when provided', async () => {
      const { calculatePopupPosition } = await import('./annotation-position');

      const result = calculatePopupPosition(
        {
          rect: { left: 100, top: 200, width: 50, height: 30, bottom: 230 } as DOMRect,
          scrollX: 0,
          scrollY: 0,
          isFixed: false,
        },
        24
      );

      expect(result.y).toBe(254); // bottom + 24
    });
  });

  describe('for fixed elements', () => {
    it('returns viewport-relative coordinates with fixed positioning', async () => {
      const { calculatePopupPosition } = await import('./annotation-position');

      const result = calculatePopupPosition({
        rect: { left: 100, top: 50, width: 200, height: 40, bottom: 90 } as DOMRect,
        scrollX: 500,
        scrollY: 1000,
        isFixed: true,
      });

      // Fixed elements ignore scroll
      expect(result.x).toBe(200); // centered: 100 + 200/2
      expect(result.y).toBe(106); // bottom + gap: 90 + 16
      expect(result.isFixed).toBe(true);
    });
  });

  describe('for absolute elements', () => {
    it('adds scroll offset to coordinates', async () => {
      const { calculatePopupPosition } = await import('./annotation-position');

      const result = calculatePopupPosition({
        rect: { left: 100, top: 200, width: 50, height: 30, bottom: 230 } as DOMRect,
        scrollX: 100,
        scrollY: 500,
        isFixed: false,
      });

      expect(result.x).toBe(225); // 100 + scrollX + width/2
      expect(result.y).toBe(746); // bottom + scrollY + gap
      expect(result.isFixed).toBe(false);
    });
  });
});

describe('getMarkerDisplayPosition', () => {
  it('returns stored position for marker display', async () => {
    const { getMarkerDisplayPosition } = await import('./annotation-position');

    const annotation = {
      x: 500,
      y: 300,
      isFixed: false,
    };

    const result = getMarkerDisplayPosition(annotation);

    expect(result).toEqual({
      x: 500,
      y: 300,
      isFixed: false,
    });
  });

  it('handles fixed annotation', async () => {
    const { getMarkerDisplayPosition } = await import('./annotation-position');

    const annotation = {
      x: 100,
      y: 50,
      isFixed: true,
    };

    const result = getMarkerDisplayPosition(annotation);

    expect(result).toEqual({
      x: 100,
      y: 50,
      isFixed: true,
    });
  });

  it('defaults isFixed to false when not specified', async () => {
    const { getMarkerDisplayPosition } = await import('./annotation-position');

    const annotation = {
      x: 100,
      y: 200,
    };

    const result = getMarkerDisplayPosition(annotation);

    expect(result.isFixed).toBe(false);
  });
});

describe('getPopupDisplayPosition', () => {
  it('calculates popup position from annotation with default gap', async () => {
    const { getPopupDisplayPosition } = await import('./annotation-position');

    const annotation = {
      x: 500,
      y: 300,
      isFixed: false,
      boundingBox: { x: 475, y: 285, width: 50, height: 30 },
    };

    const result = getPopupDisplayPosition(annotation);

    // Position below marker: y + marker height offset + gap
    // Marker is centered at (500, 300), boundingBox bottom is 285 + 30 = 315
    // Default gap is 16, but we position relative to marker center
    expect(result.x).toBe(500); // horizontal center of marker
    expect(result.y).toBe(324); // y + 24 (marker offset + gap)
    expect(result.isFixed).toBe(false);
  });

  it('handles annotation without boundingBox', async () => {
    const { getPopupDisplayPosition } = await import('./annotation-position');

    const annotation = {
      x: 500,
      y: 300,
      isFixed: false,
    };

    const result = getPopupDisplayPosition(annotation);

    // Without boundingBox, use simple offset from marker position
    expect(result.x).toBe(500);
    expect(result.y).toBe(324); // y + 24
    expect(result.isFixed).toBe(false);
  });

  it('uses custom gap', async () => {
    const { getPopupDisplayPosition } = await import('./annotation-position');

    const annotation = {
      x: 500,
      y: 300,
      isFixed: false,
    };

    const result = getPopupDisplayPosition(annotation, 32);

    expect(result.y).toBe(332); // y + 32
  });

  it('handles fixed annotation', async () => {
    const { getPopupDisplayPosition } = await import('./annotation-position');

    const annotation = {
      x: 100,
      y: 50,
      isFixed: true,
    };

    const result = getPopupDisplayPosition(annotation);

    expect(result.isFixed).toBe(true);
  });
});
