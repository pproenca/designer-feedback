import {describe, it, expect, beforeEach} from 'vitest';
import {fakeBrowser} from 'wxt/testing/fake-browser';
import {activatedTabs} from './storage-items';
import {
  ANNOTATIONS_PREFIX,
  STORAGE_KEY_VERSION,
  getAnnotationsKey,
  getAnnotationsBucketKey,
} from './storage-constants';

describe('storage-items', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  describe('activatedTabs', () => {
    it('getValue returns empty object when not set', async () => {
      const value = await activatedTabs.getValue();
      expect(value).toEqual({});
    });

    it('setValue persists record', async () => {
      const tabs = {'1': 'hash123', '2': 'hash456'};
      await activatedTabs.setValue(tabs);
      const value = await activatedTabs.getValue();
      expect(value).toEqual(tabs);
    });

    it('getValue retrieves persisted value', async () => {
      const tabs = {'10': 'origin-hash'};
      await activatedTabs.setValue(tabs);

      // Create new reference to test persistence
      const retrieved = await activatedTabs.getValue();
      expect(retrieved).toEqual(tabs);
    });
  });

  describe('constants', () => {
    it('ANNOTATIONS_PREFIX has correct value', () => {
      expect(ANNOTATIONS_PREFIX).toBe('designer-feedback:annotations:');
    });

    it('STORAGE_KEY_VERSION has correct value', () => {
      expect(STORAGE_KEY_VERSION).toBe('v2');
    });
  });

  describe('getAnnotationsKey', () => {
    it('returns correct format with hash', () => {
      const key = getAnnotationsKey('abc123');
      expect(key).toBe('v2:abc123');
    });

    it('handles empty hash', () => {
      const key = getAnnotationsKey('');
      expect(key).toBe('v2:');
    });
  });

  describe('getAnnotationsBucketKey', () => {
    it('returns prefixed key', () => {
      const key = getAnnotationsBucketKey('test-url');
      expect(key).toBe('designer-feedback:annotations:test-url');
    });
  });
});
