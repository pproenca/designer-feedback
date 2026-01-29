import {
  useReducer,
  useRef,
  useEffect,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { m, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { Annotation, ExportFormat } from '@/types';
import { exportAsImageWithNotes, exportAsSnapshotImage } from '@/utils/export';
import { isRestrictedPage } from '@/utils/screenshot';
import { getCategoryConfig } from '@/shared/categories';
import { IconClose, IconCopy, IconExport, IconImage } from '../Icons';
import { classNames } from '@/utils/classNames';

// =============================================================================
// Framer Motion Variants
// =============================================================================

const getOverlayVariants = (reduceMotion: boolean): Variants => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: reduceMotion ? 0.12 : 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: reduceMotion ? 0.1 : 0.15, ease: 'easeIn' },
  },
});

const getModalVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : { y: 12, scale: 0.96, filter: 'blur(8px)' }),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : { y: 0, scale: 1, filter: 'blur(0px)' }),
    transition: {
      duration: reduceMotion ? 0.16 : 0.25,
      ease: [0.19, 1, 0.22, 1],
    },
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : { y: -8, scale: 0.98 }),
    transition: { duration: reduceMotion ? 0.1 : 0.12, ease: 'easeIn' },
  },
});

const getStatusMessageVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : { y: 4 }),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : { y: 0 }),
    transition: { duration: reduceMotion ? 0.12 : 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : { y: -4 }),
    transition: { duration: reduceMotion ? 0.08 : 0.1, ease: 'easeIn' },
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

type ExportFormatOption = {
  id: ExportFormat;
  label: string;
  description: string;
  icon: ReactNode;
  disabled?: boolean;
  disabledHint?: string;
};

// =============================================================================
// Component
// =============================================================================

export function ExportModal({ annotations, onClose, lightMode = false }: ExportModalProps) {
  const [state, dispatch] = useReducer(exportModalReducer, initialExportModalState);
  const reduceMotion = useReducedMotion() ?? false;
  const overlayVariants = useMemo(() => getOverlayVariants(reduceMotion), [reduceMotion]);
  const modalVariants = useMemo(() => getModalVariants(reduceMotion), [reduceMotion]);
  const statusMessageVariants = useMemo(() => getStatusMessageVariants(reduceMotion), [reduceMotion]);
  const { isExporting, exportOutcome, statusMessage, selectedFormat } = state;
  const isMarkdownFormat = selectedFormat === 'image-notes';
  const isSnapshotFormat = selectedFormat === 'snapshot';
  const isClipboardFormat = isMarkdownFormat;
  const themeClassName = lightMode ? '' : 'dark';

  // Check if we're on a restricted page where screenshots cannot be captured
  const restricted = isRestrictedPage();

  // Build format options with disabled state for restricted pages
  const formatOptions: ExportFormatOption[] = [
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
  ];

  // Store timer ID for cleanup on unmount
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

  // Cleanup timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

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
          autoCloseTimerRef.current = setTimeout(() => {
            onClose();
          }, 1500);
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
        autoCloseTimerRef.current = setTimeout(() => {
          onClose();
        }, 1500);
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

  const handleFormatKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    const buttons = formatOptionsRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    if (!buttons || buttons.length === 0) return;

    const enabledOptions = formatOptions.filter((opt) => !opt.disabled);
    const currentIndex = enabledOptions.findIndex((option) => option.id === selectedFormat);
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + delta + enabledOptions.length) % enabledOptions.length;
    const nextOption = enabledOptions[nextIndex];
    dispatch({ type: 'updateState', payload: { selectedFormat: nextOption.id } });
    // Find the button index in the full list
    const fullIndex = formatOptions.findIndex((opt) => opt.id === nextOption.id);
    buttons[fullIndex]?.focus();
  };

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
            {/* Format Selection */}
            <div className="mb-3.5">
              <h3 className={classNames('text-xs font-semibold mb-2.5 uppercase tracking-widest', 'text-black/45 dark:text-white/50')}>
                Format
              </h3>
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="Export format"
                ref={formatOptionsRef}
                onKeyDown={handleFormatKeyDown}
                tabIndex={-1}
              >
                {formatOptions.map((option) => {
                  const isSelected = selectedFormat === option.id;
                  const isDisabled = option.disabled || isExporting;
                  return (
                    <button
                      key={option.id}
                      className={classNames(
                        'flex items-start gap-3 py-3 px-3.5 border rounded-xl',
                        'cursor-pointer text-left relative',
                        'transition duration-150 ease-out',
                        'active:scale-[0.98]',
                        'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none',
                        'focus-ring',
                        // Not selected
                        !isSelected && 'bg-transparent border-transparent hover:bg-df-surface-muted dark:hover:bg-df-dark-muted',
                        // Selected - subtle background, no heavy borders
                        isSelected && 'bg-df-blue/5 border-df-blue/15',
                        isSelected && 'dark:bg-df-blue/10 dark:border-df-blue/20'
                      )}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isDisabled}
                      onClick={() =>
                        dispatch({
                          type: 'updateState',
                          payload: { selectedFormat: option.id },
                        })
                      }
                    >
                      {/* Radio indicator */}
                      <span
                        className={classNames(
                          'flex items-center justify-center w-4.5 h-4.5 rounded-full border-2 shrink-0 mt-0.5',
                          'transition-colors duration-150',
                          !isSelected && 'border-black/20 dark:border-white/25',
                          isSelected && 'border-df-blue dark:border-df-blue'
                        )}
                      >
                        <span
                          className={classNames(
                            'w-2 h-2 rounded-full transition-transform duration-150',
                            isSelected ? 'bg-df-blue scale-100' : 'scale-0'
                          )}
                        />
                      </span>
                      {/* Icon */}
                      <span
                        className={classNames(
                          'inline-flex items-center justify-center w-8 h-8 rounded-xl leading-none',
                          'transition-colors duration-150',
                          // Not selected
                          !isSelected && 'bg-black/5 text-black/60',
                          !isSelected && 'dark:bg-white/8 dark:text-white/70',
                          // Selected
                          isSelected && 'bg-df-blue/10 text-df-blue',
                          isSelected && 'dark:bg-df-blue/15 dark:text-df-blue'
                        )}
                      >
                        {option.icon}
                      </span>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className={classNames('text-sm font-medium', 'text-df-ink dark:text-white')}>
                          {option.label}
                        </span>
                        <span className={classNames('text-xs leading-snug', 'text-muted-soft')}>
                          {option.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-2 mb-3.5 p-0 bg-transparent rounded-none border-none">
              <h3 className={classNames('text-xs font-semibold mb-2 uppercase tracking-widest', 'text-black/45 dark:text-white/50')}>Preview</h3>
              <div className="flex flex-col gap-1.5">
                {annotations.slice(0, 5).map((annotation, index) => {
                  const config = getCategoryConfig(annotation.category);
                  return (
                    <div
                      key={annotation.id}
                      className={classNames(
                        'flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg bg-transparent border-none',
                        'transition-colors duration-150 ease-out',
                        'hover:bg-df-surface-muted dark:hover:bg-df-dark-muted'
                      )}
                    >
                      <span
                        className={classNames(
                          'flex items-center justify-center w-5 h-5 rounded-full text-2xs font-bold shrink-0',
                          'shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]',
                          // Use category background with proper text contrast
                          config.tw.bg,
                          // Yellow category needs dark text for contrast
                          annotation.category === 'question' ? 'text-black/80' : 'text-white'
                        )}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={classNames(
                          'whitespace-nowrap overflow-hidden text-ellipsis max-w-30',
                          'text-black/75 dark:text-white/85'
                        )}
                      >
                        {annotation.element}
                      </span>
                      <span
                        className={classNames(
                          'whitespace-nowrap overflow-hidden text-ellipsis flex-1',
                          'text-black/45 dark:text-white/55'
                        )}
                      >
                        {annotation.comment}
                      </span>
                    </div>
                  );
                })}
                {annotations.length > 5 && (
                  <div className={classNames('text-xs italic pt-1', 'text-black/35 dark:text-white/45')}>
                    +{annotations.length - 5} more annotations
                  </div>
                )}
              </div>
            </div>

            {/* Status message */}
            <AnimatePresence>
              {statusMessage && (
                <m.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={statusMessageVariants}
                  id={statusMessageId}
                  className={classNames(
                    'text-sm py-2 px-3 rounded-lg mt-2',
                    statusMessage.type === 'success' &&
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                    statusMessage.type === 'error' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                    statusMessage.type === 'warning' &&
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                    statusMessage.type === 'info' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                  )}
                  role={statusMessage.type === 'error' ? 'alert' : 'status'}
                  aria-live={statusMessage.type === 'error' ? 'assertive' : 'polite'}
                >
                  {statusMessage.text}
                </m.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div
            className={classNames(
              'flex justify-end gap-2.5 py-4 px-4.5 pb-4.5 border-t',
              'border-black/8 dark:border-white/8'
            )}
          >
            <button
              className={classNames(
                'py-2 px-4 text-sm font-medium rounded-lg border-none cursor-pointer',
                'transition-interactive',
                'focus-ring',
                'active:scale-[0.98]',
                'bg-transparent text-muted-soft hover:bg-black/5 hover:text-df-ink',
                'dark:hover:bg-white/5 dark:hover:text-white'
              )}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={classNames(
                'flex items-center gap-1.5 py-2.5 px-5 text-sm font-semibold rounded-lg border-none cursor-pointer text-white',
                'bg-df-blue',
                'transition duration-150 ease-out',
                'hover:enabled:brightness-110 hover:enabled:shadow-primary-glow',
                'active:enabled:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-ring',
                isExporting && 'animate-pulse'
              )}
              type="button"
              onClick={handleExport}
              disabled={isExporting}
            >
              {exportOutcome ? (
                exportOutcome === 'copied' ? (
                  '✓ Copied!'
                ) : (
                  '✓ Downloaded!'
                )
              ) : isExporting ? (
                isClipboardFormat ? (
                  'Copying…'
                ) : (
                  'Exporting…'
                )
              ) : (
                <>
                  <IconExport size={16} aria-hidden="true" />
                  {isSnapshotFormat ? 'Download Snapshot' : isMarkdownFormat ? 'Copy Markdown' : 'Export'}
                </>
              )}
            </button>
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
