import { describe, it, expect } from 'vitest';
import { getCategoryConfig } from '@/shared/categories';
import type { FeedbackCategory } from '@/types';

describe('PendingMarker', () => {
  describe('category color mapping', () => {
    const categories: FeedbackCategory[] = ['bug', 'suggestion', 'question', 'accessibility'];

    it.each(categories)('should use correct background color for %s category', (category) => {
      const config = getCategoryConfig(category);
      expect(config.tw.bg).toBeDefined();
      expect(config.tw.bg).not.toBe('');
    });

    it('bug category should have red background', () => {
      expect(getCategoryConfig('bug').tw.bg).toBe('bg-df-red');
    });

    it('suggestion category should have blue background', () => {
      expect(getCategoryConfig('suggestion').tw.bg).toBe('bg-df-blue');
    });

    it('question category should have yellow background', () => {
      expect(getCategoryConfig('question').tw.bg).toBe('bg-df-yellow');
    });

    it('accessibility category should have purple background', () => {
      expect(getCategoryConfig('accessibility').tw.bg).toBe('bg-df-purple');
    });
  });
});
