import { describe, it, expect } from 'vitest';
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
});
