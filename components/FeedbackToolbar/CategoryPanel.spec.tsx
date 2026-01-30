import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ToolbarStateProvider, type ToolbarState, useToolbarState } from './ToolbarStateProvider';

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
  let observedState: ToolbarState | null = null;

  beforeEach(() => {
    observedState = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders all four category buttons', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      render(
        <ToolbarStateProvider initialState={{ addMode: 'category' }}>
          <CategoryPanel />
        </ToolbarStateProvider>
      );

      expect(screen.getByRole('button', { name: /bug/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /question/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /suggestion/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /accessibility/i })).toBeDefined();
    });

    it('renders nothing when closed', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      const { container } = render(
        <ToolbarStateProvider initialState={{ addMode: 'idle' }}>
          <CategoryPanel />
        </ToolbarStateProvider>
      );

      expect(container.querySelector('[data-category-panel]')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls onCategorySelect with "bug" when bug button is clicked', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      render(
        <ToolbarStateProvider initialState={{ addMode: 'category' }}>
          <StateObserver onChange={(state) => { observedState = state; }} />
          <CategoryPanel />
        </ToolbarStateProvider>
      );

      fireEvent.click(screen.getByRole('button', { name: /bug/i }));
      await act(async () => {});
      expect(observedState?.selectedCategory).toBe('bug');
      expect(observedState?.addMode).toBe('selecting');
    });
  });

  describe('accessibility', () => {
    it('has data-category attribute on each button', async () => {
      const { CategoryPanel } = await import('./CategoryPanel');
      const { container } = render(
        <ToolbarStateProvider initialState={{ addMode: 'category' }}>
          <CategoryPanel />
        </ToolbarStateProvider>
      );

      expect(container.querySelector('[data-category="bug"]')).not.toBeNull();
      expect(container.querySelector('[data-category="question"]')).not.toBeNull();
      expect(container.querySelector('[data-category="suggestion"]')).not.toBeNull();
      expect(container.querySelector('[data-category="accessibility"]')).not.toBeNull();
    });
  });
});

function StateObserver({ onChange }: { onChange: (state: ToolbarState) => void }) {
  const state = useToolbarState();

  useEffect(() => {
    onChange(state);
  }, [state, onChange]);

  return null;
}
