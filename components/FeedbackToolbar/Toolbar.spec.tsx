import type { ReactNode, HTMLAttributes, CSSProperties } from 'react';
import { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { Toolbar } from './Toolbar';
import { useAnnotationsStore } from '@/stores/annotations';
import { ToolbarStateProvider, type ToolbarState, useToolbarState } from './ToolbarStateProvider';

// Mock storage utilities used by the annotations store
vi.mock('@/utils/storage', () => ({
  loadAnnotations: vi.fn(),
  saveAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  clearAnnotations: vi.fn().mockResolvedValue(undefined),
  getStorageKey: vi.fn(() => 'test-url-key'),
  updateBadgeCount: vi.fn(),
}));

// Mock useSettings hook
const mockUpdateSettings = vi.fn();
vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({
    settings: { enabled: true, lightMode: false },
    updateSettings: mockUpdateSettings,
  })),
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

let observedState: ToolbarState | null = null;

async function renderToolbar(props?: {
  initialState?: Partial<ToolbarState>;
}) {
  const { initialState } = props ?? {};
  const utils = render(
    <ToolbarStateProvider
      initialState={{
        isExpanded: true,
        addMode: 'idle',
        selectedCategory: 'suggestion',
        pendingAnnotation: null,
        selectedAnnotationId: null,
        isExportModalOpen: false,
        isEntranceComplete: true,
        isHidden: false,
        ...initialState,
      }}
    >
      <StateObserver onChange={(state) => { observedState = state; }} />
      <Toolbar />
    </ToolbarStateProvider>
  );

  await act(async () => {});
  return utils;
}

describe('Toolbar', () => {
  beforeEach(() => {
    observedState = null;
    useAnnotationsStore.setState({ annotations: [], isLoading: false });
    mockUpdateSettings.mockClear();
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
    useAnnotationsStore.setState({ annotations: [{ id: '1' } as never], isLoading: false });

    await renderToolbar({ initialState: { isExpanded: false } });

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

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Export feedback'));
    });
    expect(observedState?.isExportModalOpen).toBe(true);
  });

  it('toggles category panel when add button is clicked', async () => {
    await renderToolbar();

    const addButton = screen.getByLabelText('Add annotation');
    await act(async () => {
      fireEvent.click(addButton);
    });
    expect(observedState?.addMode).toBe('category');
  });

  it('clears annotations and deselects active annotation', async () => {
    useAnnotationsStore.setState({ annotations: [{ id: '1' } as never], isLoading: false });
    await renderToolbar({ initialState: { selectedAnnotationId: '1' } });

    const clearButton = screen.getByLabelText('Clear all annotations');
    await act(async () => {
      fireEvent.click(clearButton);
    });

    expect(useAnnotationsStore.getState().annotations).toHaveLength(0);
    expect(observedState?.selectedAnnotationId).toBeNull();
  });

  it('calls updateSettings when theme button is clicked', async () => {
    await renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: /switch to light mode/i }));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ lightMode: true });
  });
});

function StateObserver({ onChange }: { onChange: (state: ToolbarState) => void }) {
  const state = useToolbarState();

  useEffect(() => {
    onChange(state);
  }, [state, onChange]);

  return null;
}
