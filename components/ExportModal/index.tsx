import { useReducer, useRef, useEffect, useMemo } from 'react';
import { m, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { Annotation, ExportFormat } from '@/types';
import { exportAsImageWithNotes, exportAsSnapshotImage } from '@/utils/export';
import { isRestrictedPage } from '@/utils/screenshot';
import { IconClose, IconCopy, IconImage } from '../Icons';
import { classNames } from '@/utils/classNames';
import { FormatSelector, type ExportFormatOption } from './FormatSelector';
import { AnnotationPreview } from './AnnotationPreview';
import { ExportActions } from './ExportActions';

// =============================================================================
// Framer Motion Variants (Emil Kowalski standards)
// =============================================================================

// Emil's iOS-style curves for smooth, natural motion
const EMIL_EASE_OUT: [number, number, number, number] = [0.32, 0.72, 0, 1];
const EMIL_EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1];

const getOverlayVariants = (reduceMotion: boolean): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: reduceMotion ? 0.1 : 0.15, ease: EMIL_EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: reduceMotion ? 0.08 : 0.1, ease: EMIL_EASE_IN },
  },
});

const getModalVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : { y: 8, scale: 0.96 }),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : { y: 0, scale: 1 }),
    transition: {
      duration: reduceMotion ? 0.12 : 0.2,
      ease: EMIL_EASE_OUT,
    },
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : { y: -4, scale: 0.98 }),
    transition: { duration: reduceMotion ? 0.08 : 0.1, ease: EMIL_EASE_IN },
  },
});

// =============================================================================
// Types
// =============================================================================

interface ExportModalProps {
  annotations: Annotation[];
  onClose: () => void;
  lightMode?: boolean;
}

type ExportStatus = {
  type: 'success' | 'warning' | 'error' | 'info';
  text: string;
};

type ExportState = {
  selectedFormat: ExportFormat;
  isExporting: boolean;
  exportOutcome: 'copied' | 'downloaded' | null;
  statusMessage: ExportStatus | null;
};

type ExportAction =
  | { type: 'updateState'; payload: Partial<ExportState> }
  | { type: 'resetStatus' };

const initialExportModalState: ExportState = {
  selectedFormat: 'snapshot',
  isExporting: false,
  exportOutcome: null,
  statusMessage: null,
};

function exportModalReducer(state: ExportState, action: ExportAction): ExportState {
  switch (action.type) {
    case 'updateState':
      return { ...state, ...action.payload };
    case 'resetStatus':
      return { ...state, statusMessage: null, exportOutcome: null };
    default:
      return state;
  }
}

// =============================================================================
// Component
// =============================================================================

export function ExportModal({ annotations, onClose, lightMode = false }: ExportModalProps) {
  const [state, dispatch] = useReducer(exportModalReducer, initialExportModalState);
  const reduceMotion = useReducedMotion() ?? false;
  const overlayVariants = useMemo(() => getOverlayVariants(reduceMotion), [reduceMotion]);
  const modalVariants = useMemo(() => getModalVariants(reduceMotion), [reduceMotion]);
  const { isExporting, exportOutcome, statusMessage, selectedFormat } = state;
  const isMarkdownFormat = selectedFormat === 'image-notes';
  const isSnapshotFormat = selectedFormat === 'snapshot';
  const isClipboardFormat = isMarkdownFormat;
  const themeClassName = lightMode ? '' : 'dark';

  const restricted = isRestrictedPage();

  const formatOptions: ExportFormatOption[] = useMemo(
    () => [
      {
        id: 'image-notes',
        label: 'Markdown (Clipboard)',
        description: 'Copies a concise markdown report to your clipboard.',
        icon: <IconCopy size={18} aria-hidden="true" />,
      },
      {
        id: 'snapshot',
        label: 'Snapshot (Download)',
        description: restricted
          ? 'Not available on browser pages (chrome://, about:, etc.)'
          : 'Full-page image with highlights and details sidebar.',
        icon: <IconImage size={18} aria-hidden="true" />,
        disabled: restricted,
        disabledHint: 'Not available on browser pages',
      },
    ],
    [restricted]
  );

  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const formatOptionsRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Auto-select markdown format on restricted pages
  useEffect(() => {
    if (restricted && selectedFormat === 'snapshot') {
      dispatch({ type: 'updateState', payload: { selectedFormat: 'image-notes' } });
    }
  }, [restricted, selectedFormat]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  // Focus management
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const focusable = modalRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  const getReadableError = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string') return error;
    return 'Export failed. Please try again.';
  };

  const handleExport = async () => {
    if (autoCloseTimerRef.current !== null) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    dispatch({
      type: 'updateState',
      payload: {
        isExporting: true,
        exportOutcome: null,
        statusMessage: {
          type: 'info',
          text: selectedFormat === 'snapshot' ? 'Capturing full page…' : 'Preparing export…',
        },
      },
    });
    try {
      if (selectedFormat === 'snapshot') {
        const result = await exportAsSnapshotImage(annotations);
        if (result.captureMode === 'full') {
          dispatch({
            type: 'updateState',
            payload: {
              exportOutcome: 'downloaded',
              statusMessage: { type: 'success', text: 'Snapshot downloaded.' },
            },
          });
          autoCloseTimerRef.current = setTimeout(() => onClose(), 1500);
          return;
        }

        dispatch({
          type: 'updateState',
          payload: {
            statusMessage: {
              type: 'warning',
              text:
                result.captureMode === 'viewport'
                  ? 'Snapshot downloaded, but only the visible area was captured. Try again or reduce page length.'
                  : 'Snapshot downloaded, but the screenshot was unavailable. Try again or check site restrictions.',
            },
          },
        });
      } else {
        await exportAsImageWithNotes(annotations);
        dispatch({
          type: 'updateState',
          payload: {
            exportOutcome: 'copied',
            statusMessage: { type: 'success', text: 'Markdown copied to clipboard.' },
          },
        });
        autoCloseTimerRef.current = setTimeout(() => onClose(), 1500);
      }
    } catch (error) {
      console.error('Export failed:', error);
      dispatch({
        type: 'updateState',
        payload: { statusMessage: { type: 'error', text: getReadableError(error) } },
      });
    } finally {
      dispatch({ type: 'updateState', payload: { isExporting: false } });
    }
  };

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!modalRef.current || !modalRef.current.contains(document.activeElement)) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const isShift = event.shiftKey;

      if (isShift && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!isShift && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const statusMessageId = statusMessage ? 'df-export-status' : undefined;

  return (
    <AnimatePresence>
      <m.div
        className={classNames(
          'fixed inset-0 flex items-center justify-center z-modal',
          'bg-white/90 dark:bg-black/80',
          themeClassName
        )}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Overlay dismiss button */}
        <button
          className="absolute inset-0 border-0 p-0 m-0 bg-transparent cursor-pointer z-0 focus-visible:ring-2 focus-visible:ring-df-blue/50"
          type="button"
          aria-label="Close export dialog"
          onClick={onClose}
        />

        {/* Modal */}
        <m.div
          className={classNames(
            'relative z-10 rounded-2xl w-11/12 max-w-100 max-h-[80vh] overflow-hidden overscroll-contain',
            'flex flex-col font-sans',
            'bg-white shadow-modal',
            'dark:bg-df-dark-strong dark:shadow-modal-dark'
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Export feedback"
          aria-describedby={statusMessageId}
          aria-busy={isExporting}
          ref={modalRef}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Header */}
          <div
            className={classNames(
              'flex items-center justify-between py-4 px-4.5 pb-3',
              'border-b border-black/8 dark:border-white/8'
            )}
          >
            <h2
              className={classNames('text-base font-semibold m-0 tracking-normal', 'text-df-ink dark:text-white')}
            >
              Export Feedback
            </h2>
            <button
              className={classNames(
                'flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer',
                'transition-interactive',
                'focus-ring',
                'text-muted-strong hover:bg-black/5 hover:text-df-ink hover:-translate-y-px',
                'dark:hover:bg-white/8 dark:hover:text-white'
              )}
              type="button"
              aria-label="Close export dialog"
              onClick={onClose}
            >
              <IconClose size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="py-4 px-4.5 pb-4.5 overflow-y-auto flex-1">
            <FormatSelector
              options={formatOptions}
              selectedFormat={selectedFormat}
              isExporting={isExporting}
              onFormatSelect={(format) =>
                dispatch({ type: 'updateState', payload: { selectedFormat: format } })
              }
              formatOptionsRef={formatOptionsRef}
            />
            <AnnotationPreview annotations={annotations} />
          </div>

          <ExportActions
            isExporting={isExporting}
            exportOutcome={exportOutcome}
            isSnapshotFormat={isSnapshotFormat}
            isMarkdownFormat={isMarkdownFormat}
            isClipboardFormat={isClipboardFormat}
            statusMessage={statusMessage}
            statusMessageId={statusMessageId}
            onCancel={onClose}
            onExport={handleExport}
          />
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
