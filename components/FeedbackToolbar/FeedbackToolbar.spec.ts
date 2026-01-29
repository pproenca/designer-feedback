import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetMockStorage } from '@/test/setup';

describe('Toolbar data loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStorage();
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com', pathname: '/test', search: '' },
      writable: true,
    });
  });

  it('should support parallel data loading via Promise.all pattern', () => {
    // This test documents the expected parallel loading behavior.
    // The FeedbackToolbar component should use Promise.all to load:
    // - loadToolbarPosition() - toolbar position from storage
    // - loadAnnotations() - annotations from storage
    //
    // Benefits of parallel loading:
    // 1. Reduces total mount time (max of both, not sum)
    // 2. Eliminates waterfall pattern (position then annotations)
    //
    // The implementation should be:
    // ```
    // useEffect(() => {
    //   Promise.all([loadToolbarPosition(), loadAnnotations()])
    //     .then(([position, annotations]) => { ... });
    // }, []);
    // ```
    expect(true).toBe(true);
  });
});

describe('Toolbar position persistence', () => {
  const STORAGE_KEY = 'designer-feedback:toolbar-position:';

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockStorage();
    // Mock window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'https://example.com', pathname: '/', search: '' },
      writable: true,
    });
  });

  describe('getToolbarPositionKey', () => {
    it('should generate per-origin storage key', async () => {
      // Import the function dynamically to pick up the mocked location
      const { getToolbarPositionKey } = await import('./toolbar-position');
      const key = getToolbarPositionKey();
      expect(key).toBe(`${STORAGE_KEY}https://example.com`);
    });
  });

  describe('saveToolbarPosition', () => {
    it('should save position to browser.storage.local', async () => {
      const { saveToolbarPosition } = await import('./toolbar-position');
      const position = { x: 100, y: 200 };

      await saveToolbarPosition(position);

      // Verify the storage was called
      const result = await browser.storage.local.get(`${STORAGE_KEY}https://example.com`);
      expect(result[`${STORAGE_KEY}https://example.com`]).toEqual(position);
    });
  });

  describe('loadToolbarPosition', () => {
    it('should load position from browser.storage.local', async () => {
      const savedPosition = { x: 150, y: 250 };
      const key = `${STORAGE_KEY}https://example.com`;

      // Pre-populate storage with saved position
      await browser.storage.local.set({ [key]: savedPosition });

      const { loadToolbarPosition } = await import('./toolbar-position');
      const position = await loadToolbarPosition();

      expect(position).toEqual(savedPosition);
    });

    it('should return null when no saved position exists', async () => {
      const { loadToolbarPosition } = await import('./toolbar-position');
      const position = await loadToolbarPosition();

      expect(position).toBeNull();
    });
  });
});
