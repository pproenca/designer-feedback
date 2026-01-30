import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useToolbarStore } from '@/stores/toolbar';

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
    useToolbarStore.setState({
      isExpanded: true,
      addMode: 'idle',
      selectedCategory: 'suggestion',
      pendingAnnotation: null,
      selectedAnnotationId: null,
      isExportModalOpen: false,
      isEntranceComplete: true,
      isHidden: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders all four category buttons', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      useToolbarStore.setState({ addMode: 'category' });
      render(
        <CategoryPanel />
      );

      expect(screen.getByRole('button', { name: /bug/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /question/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /suggestion/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /accessibility/i })).toBeDefined();
    });

    it('renders nothing when closed', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      const { container } = render(
        <CategoryPanel />
      );

      expect(container.querySelector('[data-category-panel]')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls onCategorySelect with "bug" when bug button is clicked', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      useToolbarStore.setState({ addMode: 'category' });
      render(
        <CategoryPanel />
      );

      fireEvent.click(screen.getByRole('button', { name: /bug/i }));
      const { selectedCategory, addMode } = useToolbarStore.getState();
      expect(selectedCategory).toBe('bug');
      expect(addMode).toBe('selecting');
    });
  });

  describe('accessibility', () => {
    it('has data-category attribute on each button', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      useToolbarStore.setState({ addMode: 'category' });
      const { container } = render(
        <CategoryPanel />
      );

      expect(container.querySelector('[data-category="bug"]')).not.toBeNull();
      expect(container.querySelector('[data-category="question"]')).not.toBeNull();
      expect(container.querySelector('[data-category="suggestion"]')).not.toBeNull();
      expect(container.querySelector('[data-category="accessibility"]')).not.toBeNull();
    });
  });
});
