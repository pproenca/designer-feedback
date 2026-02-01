import {describe, it, expect} from 'vitest';
import {DEFAULT_SETTINGS} from './settings';

describe('settings', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have lightMode enabled by default', () => {
      expect(DEFAULT_SETTINGS.lightMode).toBe(true);
    });

    it('should have extension enabled by default', () => {
      expect(DEFAULT_SETTINGS.enabled).toBe(true);
    });
  });
});
