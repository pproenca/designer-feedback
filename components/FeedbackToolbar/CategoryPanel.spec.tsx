import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, style, ...props }: HTMLAttributes<HTMLDivElement> & { style?: CSSProperties }) => (
      <div style={style} {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

describe('CategoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders all four category buttons', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      render(
        <CategoryPanel isOpen={true} onCategorySelect={vi.fn()} />
      );

      expect(screen.getByRole('button', { name: /bug/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /question/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /suggestion/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /accessibility/i })).toBeDefined();
    });

    it('renders nothing when closed', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      const { container } = render(
        <CategoryPanel isOpen={false} onCategorySelect={vi.fn()} />
      );

      expect(container.querySelector('[data-category-panel]')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls onCategorySelect with "bug" when bug button is clicked', async () => {
      const onCategorySelect = vi.fn();
      const { CategoryPanel } = await import('./CategoryPanel');
      render(
        <CategoryPanel isOpen={true} onCategorySelect={onCategorySelect} />
      );

      fireEvent.click(screen.getByRole('button', { name: /bug/i }));
      expect(onCategorySelect).toHaveBeenCalledWith('bug');
    });

    it('calls onCategorySelect with "question" when question button is clicked', async () => {
      const onCategorySelect = vi.fn();
      const { CategoryPanel } = await import('./CategoryPanel');
      render(
        <CategoryPanel isOpen={true} onCategorySelect={onCategorySelect} />
      );

      fireEvent.click(screen.getByRole('button', { name: /question/i }));
      expect(onCategorySelect).toHaveBeenCalledWith('question');
    });

    it('calls onCategorySelect with "suggestion" when suggestion button is clicked', async () => {
      const onCategorySelect = vi.fn();
      const { CategoryPanel } = await import('./CategoryPanel');
      render(
        <CategoryPanel isOpen={true} onCategorySelect={onCategorySelect} />
      );

      fireEvent.click(screen.getByRole('button', { name: /suggestion/i }));
      expect(onCategorySelect).toHaveBeenCalledWith('suggestion');
    });

    it('calls onCategorySelect with "accessibility" when accessibility button is clicked', async () => {
      const onCategorySelect = vi.fn();
      const { CategoryPanel } = await import('./CategoryPanel');
      render(
        <CategoryPanel isOpen={true} onCategorySelect={onCategorySelect} />
      );

      fireEvent.click(screen.getByRole('button', { name: /accessibility/i }));
      expect(onCategorySelect).toHaveBeenCalledWith('accessibility');
    });
  });

  describe('accessibility', () => {
    it('has data-category attribute on each button', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      const { container } = render(
        <CategoryPanel isOpen={true} onCategorySelect={vi.fn()} />
      );

      expect(container.querySelector('[data-category="bug"]')).not.toBeNull();
      expect(container.querySelector('[data-category="question"]')).not.toBeNull();
      expect(container.querySelector('[data-category="suggestion"]')).not.toBeNull();
      expect(container.querySelector('[data-category="accessibility"]')).not.toBeNull();
    });
  });
});
