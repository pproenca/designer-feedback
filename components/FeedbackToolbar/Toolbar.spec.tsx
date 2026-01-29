import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, style, ...props }: HTMLAttributes<HTMLDivElement> & { style?: CSSProperties }) => (
      <div style={style} {...props}>{children}</div>
    ),
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

// Mock useDraggable hook
vi.mock('@/hooks/useDraggable', () => ({
  useDraggable: vi.fn(() => ({
    position: { x: 100, y: 100 },
    isDragging: false,
    expandDirection: 'left',
    onMouseDown: vi.fn(),
    reset: vi.fn(),
  })),
}));

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders toolbar with expand/collapse functionality', async () => {
      const { Toolbar } = await import('./Toolbar');
      render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      // Should show controls when expanded - use getAllByRole to handle multiple buttons
      const exportButtons = screen.getAllByRole('button', { name: /export/i });
      expect(exportButtons.length).toBeGreaterThan(0);
    });

    it('shows annotation count badge when collapsed', async () => {
      const { Toolbar } = await import('./Toolbar');
      render(
        <Toolbar
          isExpanded={false}
          isEntranceComplete={true}
          annotationsCount={5}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      expect(screen.getByText('5')).toBeDefined();
    });
  });

  describe('button states', () => {
    it('disables export button when no annotations', async () => {
      const { Toolbar } = await import('./Toolbar');
      const { container } = render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      // Find the export button directly by aria-label
      const exportButton = container.querySelector('[aria-label="Export feedback"]');
      expect(exportButton).toHaveAttribute('disabled');
    });

    it('enables export button when annotations exist', async () => {
      const { Toolbar } = await import('./Toolbar');
      const { container } = render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={3}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      const exportButton = container.querySelector('[aria-label="Export feedback"]');
      expect(exportButton).not.toHaveAttribute('disabled');
    });

    it('shows active state on add button when selecting', async () => {
      const { Toolbar } = await import('./Toolbar');
      const { container } = render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={true}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      const addButton = container.querySelector('[aria-label="Cancel add annotation"]');
      expect(addButton?.className).toContain('active');
    });
  });

  describe('interactions', () => {
    it('calls onAddClick when add button is clicked', async () => {
      const onAddClick = vi.fn();
      const { Toolbar } = await import('./Toolbar');
      const { container } = render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={vi.fn()}
          onAddClick={onAddClick}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      const addButton = container.querySelector('[aria-label="Add annotation"]');
      fireEvent.click(addButton!);
      expect(onAddClick).toHaveBeenCalledTimes(1);
    });

    it('calls onExportClick when export button is clicked', async () => {
      const onExportClick = vi.fn();
      const { Toolbar } = await import('./Toolbar');
      const { container } = render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={3}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={onExportClick}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      const exportButton = container.querySelector('[aria-label="Export feedback"]');
      fireEvent.click(exportButton!);
      expect(onExportClick).toHaveBeenCalledTimes(1);
    });

    it('calls onThemeToggle when theme button is clicked', async () => {
      const onThemeToggle = vi.fn();
      const { Toolbar } = await import('./Toolbar');
      render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={onThemeToggle}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /switch to light mode/i }));
      expect(onThemeToggle).toHaveBeenCalledTimes(1);
    });

    it('expands toolbar when collapsed toolbar is clicked', async () => {
      const onExpandedChange = vi.fn();
      const { Toolbar } = await import('./Toolbar');
      const { container } = render(
        <Toolbar
          isExpanded={false}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={onExpandedChange}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      // Find the collapsed toolbar by aria-expanded="false"
      const toolbar = container.querySelector('[aria-expanded="false"]');
      fireEvent.click(toolbar!);
      expect(onExpandedChange).toHaveBeenCalledWith(true);
    });
  });

  describe('theme', () => {
    it('shows sun icon in dark mode', async () => {
      const { Toolbar } = await import('./Toolbar');
      render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={false}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeDefined();
    });

    it('shows moon icon in light mode', async () => {
      const { Toolbar } = await import('./Toolbar');
      render(
        <Toolbar
          isExpanded={true}
          isEntranceComplete={true}
          annotationsCount={0}
          onExpandedChange={vi.fn()}
          onAddClick={vi.fn()}
          onExportClick={vi.fn()}
          onClearClick={vi.fn()}
          onThemeToggle={vi.fn()}
          isSelectingElement={false}
          isCategoryPanelOpen={false}
          lightMode={true}
          tooltipsReady={true}
          onTooltipWarmup={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeDefined();
    });
  });
});
