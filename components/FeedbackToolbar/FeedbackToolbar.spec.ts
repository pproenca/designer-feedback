// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { toolbarPositions } from '@/utils/storage-items';

describe('Toolbar position persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeBrowser.reset();
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com', pathname: '/', search: '' },
      writable: true,
    });
  });

  describe('saveToolbarPosition', () => {
    it('should save position to consolidated positions object', async () => {
      const { saveToolbarPosition } = await import('./toolbar-position');
      const position = { x: 100, y: 200 };

      await saveToolbarPosition(position);

      // Verify using the defineItem's getValue
      const positions = await toolbarPositions.getValue();
      expect(positions).toEqual({
        'https://example.com': position,
      });
    });

    it('should preserve positions for other origins', async () => {
      // Pre-populate storage with existing positions using setValue
      await toolbarPositions.setValue({
        'https://other.com': { x: 50, y: 50 },
      });

      const { saveToolbarPosition } = await import('./toolbar-position');
      const position = { x: 100, y: 200 };

      await saveToolbarPosition(position);

      // Verify both positions are preserved
      const positions = await toolbarPositions.getValue();
      expect(positions).toEqual({
        'https://other.com': { x: 50, y: 50 },
        'https://example.com': position,
      });
    });
  });

  describe('loadToolbarPosition', () => {
    it('should load position for current origin', async () => {
      const savedPosition = { x: 150, y: 250 };

      // Pre-populate storage with saved positions
      await toolbarPositions.setValue({
        'https://example.com': savedPosition,
        'https://other.com': { x: 50, y: 50 },
      });

      const { loadToolbarPosition } = await import('./toolbar-position');
      const position = await loadToolbarPosition();

      expect(position).toEqual(savedPosition);
    });

    it('should return null when no saved position exists', async () => {
      const { loadToolbarPosition } = await import('./toolbar-position');
      const position = await loadToolbarPosition();

      expect(position).toBeNull();
    });

    it('should return null when origin not in positions map', async () => {
      // Pre-populate storage with positions for other origins
      await toolbarPositions.setValue({
        'https://other.com': { x: 50, y: 50 },
      });

      const { loadToolbarPosition } = await import('./toolbar-position');
      const position = await loadToolbarPosition();

      expect(position).toBeNull();
    });
  });
});
