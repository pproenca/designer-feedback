import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '@/test/setup';
import styles from './styles.module.scss';

describe('FeedbackToolbar styles', () => {
  describe('CSS classes exist', () => {
    it('should have toolbar class', () => {
      expect(styles.toolbar).toBeDefined();
    });

    it('should have dragging class for drag state', () => {
      expect(styles.dragging).toBeDefined();
    });

    it('should have buttonTooltip class', () => {
      expect(styles.buttonTooltip).toBeDefined();
    });

    it('should have categoryPanel class', () => {
      expect(styles.categoryPanel).toBeDefined();
    });
  });

  describe('smart expansion CSS classes', () => {
    it('should have expandLeft class as a non-empty string', () => {
      // Must be a string (not undefined) and non-empty
      expect(styles.expandLeft).toBeTruthy();
      expect(typeof styles.expandLeft).toBe('string');
      expect(styles.expandLeft.length).toBeGreaterThan(0);
    });

    it('should have expandRight class as a non-empty string', () => {
      // Must be a string (not undefined) and non-empty
      expect(styles.expandRight).toBeTruthy();
      expect(typeof styles.expandRight).toBe('string');
      expect(styles.expandRight.length).toBeGreaterThan(0);
    });
  });
});

describe('Toolbar position persistence', () => {
  const STORAGE_KEY = 'designer-feedback:toolbar-position:';

  beforeEach(() => {
    vi.clearAllMocks();
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
    it('should save position to chrome.storage.local', async () => {
      mockChrome.storage.local.set.mockImplementation((_, callback) => callback?.());

      const { saveToolbarPosition } = await import('./toolbar-position');
      const position = { x: 100, y: 200 };

      await saveToolbarPosition(position);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        { [`${STORAGE_KEY}https://example.com`]: position },
        expect.any(Function)
      );
    });
  });

  describe('loadToolbarPosition', () => {
    it('should load position from chrome.storage.local', async () => {
      const savedPosition = { x: 150, y: 250 };
      mockChrome.storage.local.get.mockImplementation((keysObj, callback) => {
        const key = Object.keys(keysObj)[0];
        callback({ [key]: savedPosition });
      });

      const { loadToolbarPosition } = await import('./toolbar-position');
      const position = await loadToolbarPosition();

      expect(position).toEqual(savedPosition);
    });

    it('should return null when no saved position exists', async () => {
      mockChrome.storage.local.get.mockImplementation((_keys, callback) => {
        callback({});
      });

      const { loadToolbarPosition } = await import('./toolbar-position');
      const position = await loadToolbarPosition();

      expect(position).toBeNull();
    });
  });
});
