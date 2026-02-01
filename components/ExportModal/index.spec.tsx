// @vitest-environment jsdom
import type {HTMLAttributes, ReactNode} from 'react';
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, fireEvent, cleanup, act, within} from '@testing-library/react';
import {ExportModal} from './index';
import {exportAsImageWithNotes, exportAsSnapshotImage} from '@/utils/export';
import {isRestrictedPage} from '@/utils/dom/screenshot';
import type {Annotation} from '@/types';
import {ToastProvider} from '@/components/Toast';

// Verify ExportModal is a named export (supports lazy loading with transform)
describe('ExportModal module structure', () => {
  it('exports ExportModal as a named export for lazy loading', async () => {
    const module = await import('./index');
    expect(module.ExportModal).toBeDefined();
    expect(typeof module.ExportModal).toBe('function');
  });

  it('can be dynamically imported', async () => {
    const loadModule = () =>
      import('./index').then(m => ({default: m.ExportModal}));
    const module = await loadModule();
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe('function');
  });
});

// Mock export utilities
vi.mock('@/utils/export', () => ({
  exportAsImageWithNotes: vi.fn().mockResolvedValue(undefined),
  exportAsSnapshotImage: vi.fn().mockResolvedValue({captureMode: 'full'}),
}));

vi.mock('@/utils/dom/screenshot', () => ({
  isRestrictedPage: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: {enabled: true, lightMode: true},
    updateSettings: () => {},
  }),
}));

// Mock Framer Motion to avoid animation timing issues in tests
vi.mock('framer-motion', () => ({
  m: {
    div: ({children, ...props}: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    span: ({children, ...props}: HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({children}: {children: ReactNode}) => <>{children}</>,
  useReducedMotion: () => false,
}));

const mockAnnotations: Annotation[] = [
  {
    id: '1',
    x: 100,
    y: 200,
    comment: 'Test annotation',
    category: 'bug',
    element: 'div',
    elementPath: 'body > div',
    timestamp: Date.now(),
    isFixed: false,
    boundingBox: {x: 100, y: 200, width: 50, height: 50},
  },
];

describe('ExportModal', () => {
  const mockedExportAsImageWithNotes = vi.mocked(exportAsImageWithNotes);
  const mockedExportAsSnapshotImage = vi.mocked(exportAsSnapshotImage);
  const mockedIsRestrictedPage = vi.mocked(isRestrictedPage);

  // Create a mock shadow root for portal rendering
  let mockShadowHost: HTMLDivElement;
  let mockShadowRoot: ShadowRoot;
  // Shadow-scoped screen queries (portal renders into shadow root)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let screen: any;
  const defaultCaptureChange = vi.fn();

  const renderModal = (props: {
    onClose: () => void;
    onCaptureChange?: (isCapturing: boolean) => void;
  }) =>
    render(
      <ToastProvider>
        <ExportModal
          annotations={mockAnnotations}
          onClose={props.onClose}
          onCaptureChange={props.onCaptureChange ?? defaultCaptureChange}
          shadowRoot={mockShadowRoot}
        />
      </ToastProvider>
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockedExportAsImageWithNotes.mockResolvedValue(undefined);
    mockedExportAsSnapshotImage.mockResolvedValue({captureMode: 'full'});
    mockedIsRestrictedPage.mockReturnValue(false);

    // Set up mock shadow DOM
    mockShadowHost = document.createElement('div');
    document.body.appendChild(mockShadowHost);
    mockShadowRoot = mockShadowHost.attachShadow({mode: 'open'});
    // Portal renders into shadow root, so query within it
    screen = within(mockShadowRoot as unknown as HTMLElement);
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    // Clean up mock shadow DOM
    if (mockShadowHost.parentNode) {
      mockShadowHost.parentNode.removeChild(mockShadowHost);
    }
  });

  it('downloads snapshot and auto-closes on success', async () => {
    const onClose = vi.fn();

    renderModal({onClose, onCaptureChange: defaultCaptureChange});

    const exportButton = screen.getByRole('button', {
      name: /download snapshot/i,
    });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(mockedExportAsSnapshotImage).toHaveBeenCalledWith(mockAnnotations);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(defaultCaptureChange).toHaveBeenCalledWith(true);
    expect(defaultCaptureChange).toHaveBeenCalledWith(false);
  });

  it('closes after snapshot uses placeholder', async () => {
    mockedExportAsSnapshotImage.mockResolvedValue({captureMode: 'placeholder'});
    const onClose = vi.fn();

    renderModal({onClose, onCaptureChange: defaultCaptureChange});

    const exportButton = screen.getByRole('button', {
      name: /download snapshot/i,
    });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes after snapshot falls back to viewport capture', async () => {
    mockedExportAsSnapshotImage.mockResolvedValue({captureMode: 'viewport'});
    const onClose = vi.fn();

    renderModal({onClose, onCaptureChange: defaultCaptureChange});

    const exportButton = screen.getByRole('button', {
      name: /download snapshot/i,
    });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exports markdown to clipboard and auto-closes', async () => {
    const onClose = vi.fn();

    renderModal({onClose, onCaptureChange: defaultCaptureChange});

    // Click on the Markdown label to select it (Base UI RadioGroup structure)
    const markdownLabel = screen
      .getByText('Markdown (Clipboard)')
      .closest('label');
    await act(async () => {
      fireEvent.click(markdownLabel!);
    });

    const exportButton = screen.getByRole('button', {name: /copy markdown/i});
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(mockedExportAsImageWithNotes).toHaveBeenCalledWith(mockAnnotations);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables snapshot option on restricted pages', async () => {
    mockedIsRestrictedPage.mockReturnValue(true);

    renderModal({onClose: () => {}, onCaptureChange: defaultCaptureChange});

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Snapshot option should be disabled (Base UI uses data-disabled attribute)
    const radios = screen.getAllByRole('radio');
    const snapshotRadio = radios.find((r: HTMLElement) =>
      r.hasAttribute('data-disabled')
    );
    expect(snapshotRadio).toBeInTheDocument();

    // Should show "not available" message
    expect(
      screen.getByText(/not available on browser pages/i)
    ).toBeInTheDocument();
  });

  it('auto-selects markdown format on restricted pages', async () => {
    mockedIsRestrictedPage.mockReturnValue(true);

    renderModal({onClose: () => {}, onCaptureChange: defaultCaptureChange});

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Markdown option should be selected (Base UI RadioGroup)
    const radios = screen.getAllByRole('radio');
    // On restricted pages, markdown (image-notes) is auto-selected
    // The non-disabled radio with aria-checked=true should be the markdown option
    const selectedRadio = radios.find(
      (r: HTMLElement) =>
        r.getAttribute('aria-checked') === 'true' &&
        !r.hasAttribute('data-disabled')
    );
    expect(selectedRadio).toBeInTheDocument();
  });

  it('shows error when export fails', async () => {
    mockedExportAsSnapshotImage.mockRejectedValue(new Error('Network error'));
    const onClose = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderModal({onClose, onCaptureChange: defaultCaptureChange});

    const exportButton = screen.getByRole('button', {
      name: /download snapshot/i,
    });
    await act(async () => {
      fireEvent.click(exportButton);
      await vi.runAllTimersAsync();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Export failed:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
