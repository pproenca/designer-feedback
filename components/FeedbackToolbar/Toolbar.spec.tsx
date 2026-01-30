import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import { useToolbarStore } from '@/stores/toolbar';
import { useAnnotationsStore } from '@/stores/annotations';

// Mock storage utilities used by the annotations store
vi.mock('@/utils/storage', () => ({
  loadAnnotations: vi.fn(),
  saveAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  clearAnnotations: vi.fn().mockResolvedValue(undefined),
  getStorageKey: vi.fn(() => 'test-url-key'),
  updateBadgeCount: vi.fn(),
}));

vi.mock('./toolbar-position', () => ({
  loadToolbarPosition: vi.fn().mockResolvedValue(null),
  saveToolbarPosition: vi.fn(),
}));

// Mock Framer Motion - filter out non-DOM props to avoid React warnings
const filterMotionProps = (props: Record<string, unknown>) => {
  const motionProps = [
    'initial',
    'animate',
    'exit',
    'variants',
    'transition',
    'whileHover',
    'whileTap',
    'whileFocus',
    'whileDrag',
    'layout',
    'layoutId',
    'onAnimationStart',
    'onAnimationComplete',
  ];
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!motionProps.includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
};

vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, style, ...props }: HTMLAttributes<HTMLDivElement> & { style?: CSSProperties }) => (
      <div style={style} {...filterMotionProps(props)}>{children}</div>
    ),
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => (
      <span {...filterMotionProps(props)}>{children}</span>
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

async function renderToolbar(props?: { lightMode?: boolean; onThemeToggle?: () => void }) {
  const { lightMode = false, onThemeToggle = vi.fn() } = props ?? {};
  const utils = render(
    <Toolbar
      lightMode={lightMode}
      onThemeToggle={onThemeToggle}
    />
  );

  await act(async () => {});
  return { ...utils, onThemeToggle };
}

describe('Toolbar', () => {
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
    useAnnotationsStore.setState({ annotations: [], isLoading: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders toolbar controls when expanded', async () => {
    await renderToolbar();

    const exportButton = screen.getByLabelText('Export feedback');
    expect(exportButton).toBeInTheDocument();
  });

  it('shows annotation count badge when collapsed', async () => {
    useToolbarStore.setState({ isExpanded: false });
    useAnnotationsStore.setState({ annotations: [{ id: '1' } as never], isLoading: false });

    await renderToolbar();

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('disables export button when there are no annotations', async () => {
    await renderToolbar();

    const exportButton = screen.getByLabelText('Export feedback');
    expect(exportButton).toBeDisabled();
  });

  it('opens export modal when export button is clicked', async () => {
    useAnnotationsStore.setState({ annotations: [{ id: '1' } as never], isLoading: false });

    await renderToolbar();

    fireEvent.click(screen.getByLabelText('Export feedback'));
    expect(useToolbarStore.getState().isExportModalOpen).toBe(true);
  });

  it('toggles category panel when add button is clicked', async () => {
    await renderToolbar();

    const addButton = screen.getByLabelText('Add annotation');
    fireEvent.click(addButton);
    expect(useToolbarStore.getState().addMode).toBe('category');
  });

  it('clears annotations and deselects active annotation', async () => {
    useAnnotationsStore.setState({ annotations: [{ id: '1' } as never], isLoading: false });
    useToolbarStore.setState({ selectedAnnotationId: '1' });

    await renderToolbar();

    const clearButton = screen.getByLabelText('Clear all annotations');
    await act(async () => {
      fireEvent.click(clearButton);
    });

    expect(useAnnotationsStore.getState().annotations).toHaveLength(0);
    expect(useToolbarStore.getState().selectedAnnotationId).toBeNull();
  });

  it('calls onThemeToggle when theme button is clicked', async () => {
    const onThemeToggle = vi.fn();
    await renderToolbar({ onThemeToggle });

    fireEvent.click(screen.getByRole('button', { name: /switch to light mode/i }));
    expect(onThemeToggle).toHaveBeenCalledTimes(1);
  });
});
