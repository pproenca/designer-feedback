import React, { type HTMLAttributes, type ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { FormatSelector, type ExportFormatOption } from './FormatSelector';
import { ExportProvider, initialExportState, type ExportState, type ExportAction } from './ExportContext';
import type { ExportFormat } from '@/types';

// Mock Framer Motion to avoid animation timing issues in tests
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

const createMockOptions = (): ExportFormatOption[] => [
  {
    id: 'snapshot' as ExportFormat,
    label: 'Snapshot',
    description: 'Download as image with annotations',
    icon: <span data-testid="snapshot-icon">S</span>,
  },
  {
    id: 'image-notes' as ExportFormat,
    label: 'Markdown',
    description: 'Copy report to clipboard',
    icon: <span data-testid="markdown-icon">M</span>,
  },
];

const createOptionsWithDisabled = (): ExportFormatOption[] => [
  {
    id: 'snapshot' as ExportFormat,
    label: 'Snapshot',
    description: 'Download as image with annotations',
    icon: <span data-testid="snapshot-icon">S</span>,
    disabled: true,
    disabledHint: 'Not available on this page',
  },
  {
    id: 'image-notes' as ExportFormat,
    label: 'Markdown',
    description: 'Copy report to clipboard',
    icon: <span data-testid="markdown-icon">M</span>,
  },
];

interface TestWrapperProps {
  children: ReactNode;
  state?: Partial<ExportState>;
  dispatch?: React.Dispatch<ExportAction>;
}

function TestWrapper({ children, state, dispatch }: TestWrapperProps) {
  const mockDispatch = dispatch ?? vi.fn();
  const mockState: ExportState = {
    ...initialExportState,
    ...state,
  };

  return (
    <ExportProvider
      state={mockState}
      dispatch={mockDispatch}
      onClose={vi.fn()}
      handleExport={vi.fn()}
    >
      {children}
    </ExportProvider>
  );
}

describe('FormatSelector', () => {
  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders all format options', () => {
      const options = createMockOptions();
      render(
        <TestWrapper state={{ selectedFormat: 'snapshot' }}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      expect(screen.getByText('Snapshot')).toBeInTheDocument();
      expect(screen.getByText('Markdown')).toBeInTheDocument();
    });

    it('renders radiogroup with accessible label', () => {
      const options = createMockOptions();
      render(
        <TestWrapper state={{ selectedFormat: 'snapshot' }}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      // Base UI uses aria-labelledby, so we find the group by its role
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
      expect(screen.getByText('Format')).toBeInTheDocument();
    });

    it('shows selected state with aria-checked', () => {
      const options = createMockOptions();
      render(
        <TestWrapper state={{ selectedFormat: 'image-notes' }}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole('radio');
      const snapshotRadio = radios.find((r) => r.getAttribute('aria-checked') === 'false');
      const markdownRadio = radios.find((r) => r.getAttribute('aria-checked') === 'true');

      expect(snapshotRadio).toBeInTheDocument();
      expect(markdownRadio).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('calls dispatch when clicking an option', () => {
      const mockDispatch = vi.fn();
      const options = createMockOptions();

      render(
        <TestWrapper state={{ selectedFormat: 'snapshot' }} dispatch={mockDispatch}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      // Click on the Markdown label to select it
      const markdownLabel = screen.getByText('Markdown').closest('label');
      act(() => {
        fireEvent.click(markdownLabel!);
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'updateState',
        payload: { selectedFormat: 'image-notes' },
      });
    });

    it('does not call dispatch when clicking disabled option', () => {
      const mockDispatch = vi.fn();
      const options = createOptionsWithDisabled();

      render(
        <TestWrapper state={{ selectedFormat: 'image-notes' }} dispatch={mockDispatch}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      // Try to click on the disabled Snapshot label
      const snapshotLabel = screen.getByText('Snapshot').closest('label');
      act(() => {
        fireEvent.click(snapshotLabel!);
      });
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('disables all options when isExporting is true', () => {
      const options = createMockOptions();
      render(
        <TestWrapper state={{ selectedFormat: 'snapshot', isExporting: true }}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      const radiogroup = screen.getByRole('radiogroup');
      expect(radiogroup).toHaveAttribute('data-disabled');
    });
  });

  describe('keyboard navigation (handled by Base UI)', () => {
    // Base UI RadioGroup handles keyboard navigation internally with WAI-ARIA patterns.
    // These tests verify the accessible structure that enables keyboard navigation.

    it('has focusable radio items', () => {
      const options = createMockOptions();
      render(
        <TestWrapper state={{ selectedFormat: 'snapshot' }}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole('radio');
      // The selected radio should be tabbable (tabindex=0)
      const selectedRadio = radios.find((r) => r.getAttribute('aria-checked') === 'true');
      expect(selectedRadio).toHaveAttribute('tabindex', '0');
    });

    it('marks disabled items as not focusable', () => {
      const options = createOptionsWithDisabled();
      render(
        <TestWrapper state={{ selectedFormat: 'image-notes' }}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole('radio');
      const disabledRadio = radios.find((r) => r.hasAttribute('data-disabled'));
      // Disabled items should not be tabbable
      expect(disabledRadio).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('disabled state', () => {
    it('shows disabled option with correct attributes', () => {
      const options = createOptionsWithDisabled();
      render(
        <TestWrapper state={{ selectedFormat: 'image-notes' }}>
          <FormatSelector options={options} />
        </TestWrapper>
      );

      const radios = screen.getAllByRole('radio');
      const disabledRadio = radios.find((r) => r.hasAttribute('data-disabled'));
      expect(disabledRadio).toBeInTheDocument();
    });
  });
});
