import {
  useReducer,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import type { Annotation, ExportFormat } from '@/types';
import { exportAsImageWithNotes, exportAsSnapshotImage } from '@/utils/export';
import { hasScreenshotPermission, requestScreenshotPermission } from '@/utils/permissions';
import { getCategoryConfig } from '@/shared/categories';
import { IconClose, IconCopy, IconExport, IconImage } from '../Icons';

// =============================================================================
// Utility: conditional class name helper
// =============================================================================

function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// =============================================================================
// Framer Motion Variants
// =============================================================================

const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.96,
    filter: 'blur(8px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.25,
      ease: [0.19, 1, 0.22, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

const statusMessageVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.1, ease: 'easeIn' },
  },
};

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
  permissionDenied: boolean;
  isRequestingPermission: boolean;
};

type ExportAction =
  | { type: 'updateState'; payload: Partial<ExportState> }
  | { type: 'resetStatus' };

const initialExportModalState: ExportState = {
  selectedFormat: 'snapshot',
  isExporting: false,
  exportOutcome: null,
  statusMessage: null,
  permissionDenied: false,
  isRequestingPermission: false,
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
};

const EXPORT_FORMAT_OPTIONS: ExportFormatOption[] = [
  {
    id: 'image-notes',
    label: 'Markdown (Clipboard)',
    description: 'Copies a concise markdown report to your clipboard.',
    icon: <IconCopy size={18} />,
  },
  {
    id: 'snapshot',
    label: 'Snapshot (Download)',
    description: 'Full-page image with highlights and details sidebar.',
    icon: <IconImage size={18} />,
  },
];

// =============================================================================
// Component
// =============================================================================

export function ExportModal({ annotations, onClose, lightMode = false }: ExportModalProps) {
  const [state, dispatch] = useReducer(exportModalReducer, initialExportModalState);
  const {
    isExporting,
    exportOutcome,
    statusMessage,
    permissionDenied,
    isRequestingPermission,
    selectedFormat,
  } = state;
  const isMarkdownFormat = selectedFormat === 'image-notes';
  const isSnapshotFormat = selectedFormat === 'snapshot';
  const isClipboardFormat = isMarkdownFormat;
  const themeClassName = lightMode ? '' : 'dark';

  // Store timer ID for cleanup on unmount
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const formatOptionsRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Cleanup timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  const getScreenshotOriginPattern = (): string | undefined => {
    try {
      const origin = window.location.origin;
      if (!origin || origin === 'null') return undefined;
      return `${origin}/*`;
    } catch {
      return undefined;
    }
  };

  useEffect(() => {
    dispatch({ type: 'resetStatus' });
    if (selectedFormat !== 'snapshot') {
      dispatch({ type: 'updateState', payload: { permissionDenied: false } });
      return;
    }

    let isCancelled = false;
    const origin = getScreenshotOriginPattern();
    hasScreenshotPermission(origin).then((granted) => {
      if (!isCancelled) {
        dispatch({ type: 'updateState', payload: { permissionDenied: !granted } });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [selectedFormat]);

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

  const handlePermissionRequest = async () => {
    if (isRequestingPermission) return;
    dispatch({
      type: 'updateState',
      payload: { isRequestingPermission: true, statusMessage: null },
    });

    const origin = getScreenshotOriginPattern();
    const granted = await requestScreenshotPermission(origin);
    if (granted) {
      dispatch({
        type: 'updateState',
        payload: {
          isRequestingPermission: false,
          permissionDenied: false,
          statusMessage: {
            type: 'success',
            text: 'Permission granted. You can export the snapshot now.',
          },
        },
      });
    } else {
      dispatch({
        type: 'updateState',
        payload: {
          isRequestingPermission: false,
          permissionDenied: true,
          statusMessage: {
            type: 'error',
            text: 'Permission is required to capture screenshots. Please grant access to continue.',
          },
        },
      });
    }
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
          text:
            selectedFormat === 'snapshot' ? 'Capturing full page...' : 'Preparing export...',
        },
      },
    });
    try {
      if (selectedFormat === 'snapshot') {
        const origin = getScreenshotOriginPattern();
        const hasPermission = await requestScreenshotPermission(origin);
        if (!hasPermission) {
          dispatch({
            type: 'updateState',
            payload: {
              permissionDenied: true,
              statusMessage: {
                type: 'error',
                text: 'Screenshot permission is required. Click "Grant access" and try again.',
              },
            },
          });
          return;
        }
        dispatch({ type: 'updateState', payload: { permissionDenied: false } });
        const result = await exportAsSnapshotImage(annotations, { hasPermission });
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
    const buttons =
      formatOptionsRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    if (!buttons || buttons.length === 0) return;

    const currentIndex = EXPORT_FORMAT_OPTIONS.findIndex(
      (option) => option.id === selectedFormat
    );
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + EXPORT_FORMAT_OPTIONS.length) %
          EXPORT_FORMAT_OPTIONS.length;
    const nextOption = EXPORT_FORMAT_OPTIONS[nextIndex];
    dispatch({ type: 'updateState', payload: { selectedFormat: nextOption.id } });
    buttons[nextIndex]?.focus();
  };

  const statusMessageId = statusMessage ? 'df-export-status' : undefined;

  return (
    <AnimatePresence>
      <motion.div
        className={classNames(
          'fixed inset-0 flex items-center justify-center z-modal',
          'bg-[rgba(250,250,250,0.88)] dark:bg-[rgba(10,10,10,0.82)]',
          themeClassName
        )}
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Overlay dismiss button */}
        <button
          className="absolute inset-0 border-0 p-0 m-0 bg-transparent cursor-pointer z-0"
          type="button"
          aria-label="Close export dialog"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className={classNames(
            'relative z-[1] rounded-[18px] w-[90%] max-w-[400px] max-h-[80vh] overflow-hidden',
            'flex flex-col font-sans',
            'bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.06)]',
            'dark:bg-[#151515] dark:shadow-[0_18px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)]'
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
              'flex items-center justify-between py-[0.95rem] px-[1.1rem] pb-[0.8rem]',
              'border-b border-black/8 dark:border-white/8'
            )}
          >
            <h2
              className={classNames(
                'text-[1.05rem] font-semibold m-0 tracking-[0.01em]',
                'text-[#1a1a1a] dark:text-white'
              )}
            >
              Export Feedback
            </h2>
            <button
              className={classNames(
                'flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer',
                'transition-all duration-150 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                'text-black/40 hover:bg-black/5 hover:text-[#1a1a1a] hover:-translate-y-px',
                'dark:text-white/55 dark:hover:bg-white/8 dark:hover:text-white'
              )}
              type="button"
              aria-label="Close export dialog"
              onClick={onClose}
            >
              <IconClose size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="py-4 px-[1.1rem] pb-[1.1rem] overflow-y-auto flex-1">
            {/* Summary */}
            <div className="mb-4 px-1 bg-transparent rounded-none border-none">
              <div className="flex items-center justify-between">
                <span
                  className={classNames(
                    'text-[0.8125rem] tracking-[0.04em]',
                    'text-black/50 dark:text-white/60'
                  )}
                >
                  Total annotations
                </span>
                <span
                  className={classNames(
                    'text-[0.82rem] font-semibold p-0 bg-none border-none',
                    'text-[#1a1a1a] dark:text-white'
                  )}
                >
                  {annotations.length}
                </span>
              </div>
            </div>

            {/* Format Selection */}
            <div className="mb-[0.9rem]">
              <h3
                className={classNames(
                  'text-xs font-medium mb-[0.6rem] tracking-[0.04em]',
                  'text-black/40 dark:text-white/55'
                )}
              >
                Export Format
              </h3>
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="Export format"
                ref={formatOptionsRef}
                onKeyDown={handleFormatKeyDown}
                tabIndex={0}
              >
                {EXPORT_FORMAT_OPTIONS.map((option) => {
                  const isSelected = selectedFormat === option.id;
                  return (
                    <button
                      key={option.id}
                      className={classNames(
                        'flex items-start gap-3 py-[0.8rem] px-[0.9rem] bg-transparent border rounded-[10px]',
                        'cursor-pointer text-left relative',
                        'transition-all duration-150 ease-out',
                        'active:scale-[0.99]',
                        'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                        // Not selected
                        !isSelected && 'border-transparent hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c]',
                        // Selected
                        isSelected && 'bg-[#f4f4f5] border-black/8 border-l-2 border-l-df-blue',
                        isSelected && 'dark:bg-[#1c1c1c] dark:border-white/8'
                      )}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isExporting}
                      onClick={() =>
                        dispatch({
                          type: 'updateState',
                          payload: { selectedFormat: option.id },
                        })
                      }
                    >
                      <span
                        className={classNames(
                          'inline-flex items-center justify-center w-8 h-8 rounded-[10px] leading-none',
                          'border',
                          // Not selected
                          !isSelected && 'bg-black/[0.06] border-black/8 text-black/70',
                          !isSelected && 'dark:bg-[#2a2a2a] dark:border-white/8 dark:text-white/85',
                          // Selected
                          isSelected && 'bg-df-blue/10 border-df-blue/20 text-df-blue',
                          isSelected && 'dark:bg-df-blue/[0.12] dark:border-df-blue/[0.22] dark:text-[#d5e3ff]'
                        )}
                      >
                        {option.icon}
                      </span>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span
                          className={classNames(
                            'text-sm font-medium',
                            'text-[#1a1a1a] dark:text-white'
                          )}
                        >
                          {option.label}
                        </span>
                        <span
                          className={classNames(
                            'text-[0.72rem] leading-[1.35]',
                            'text-black/50 dark:text-white/60'
                          )}
                        >
                          {option.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Permission callout for snapshot */}
            {isSnapshotFormat && (
              <div
                className={classNames(
                  'flex items-center justify-between gap-3 py-[0.7rem] px-[0.8rem] mb-[0.9rem] rounded-xl border',
                  !permissionDenied && 'bg-[#f4f4f5] border-black/8 dark:bg-[#1c1c1c] dark:border-white/8',
                  permissionDenied && 'bg-red-600/[0.08] border-red-600/[0.35] dark:bg-red-500/[0.12] dark:border-red-500/50'
                )}
              >
                <div className="flex flex-col gap-0.5 flex-1">
                  <span
                    className={classNames(
                      'text-[0.78rem] font-semibold tracking-[0.02em]',
                      'text-[#1a1a1a] dark:text-white'
                    )}
                  >
                    Screenshot access
                  </span>
                  <span
                    className={classNames(
                      'text-[0.72rem] leading-[1.4]',
                      'text-black/55 dark:text-white/60'
                    )}
                  >
                    Needed to include the page in your snapshot. Long pages can take a few seconds.
                  </span>
                </div>
                {permissionDenied && (
                  <button
                    className={classNames(
                      'py-[0.45rem] px-3 rounded-full border text-[0.72rem] font-semibold cursor-pointer',
                      'transition-all duration-150 ease-out',
                      'hover:enabled:-translate-y-px active:enabled:scale-[0.98]',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                      'bg-blue-600/[0.12] border-blue-600/[0.35] text-blue-800 hover:enabled:bg-blue-600/[0.18]',
                      'dark:bg-df-blue/[0.18] dark:border-df-blue/[0.35] dark:text-[#d5e3ff] dark:hover:enabled:bg-df-blue/[0.28]'
                    )}
                    type="button"
                    onClick={handlePermissionRequest}
                    disabled={isRequestingPermission}
                  >
                    {isRequestingPermission ? 'Requesting...' : 'Grant access'}
                  </button>
                )}
              </div>
            )}

            {/* Preview */}
            <div className="mt-2 mb-[0.9rem] p-0 bg-transparent rounded-none border-none">
              <h3
                className={classNames(
                  'text-xs font-medium mb-[0.55rem] tracking-[0.04em]',
                  'text-black/40 dark:text-white/55'
                )}
              >
                Preview
              </h3>
              <div className="flex flex-col gap-[0.4rem]">
                {annotations.slice(0, 5).map((annotation, index) => {
                  const config = getCategoryConfig(annotation.category);
                  return (
                    <div
                      key={annotation.id}
                      className={classNames(
                        'flex items-center gap-2 text-[0.8rem] py-[0.35rem] px-[0.45rem] rounded-lg bg-transparent border-none',
                        'transition-colors duration-150 ease-out',
                        'hover:bg-[#f4f4f5] dark:hover:bg-[#1c1c1c]'
                      )}
                    >
                      <span
                        className="flex items-center justify-center w-[18px] h-[18px] rounded-full text-[0.625rem] font-semibold text-white shrink-0 shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
                        style={{ backgroundColor: config.color }}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={classNames(
                          'whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]',
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
                  <div
                    className={classNames(
                      'text-xs italic pt-1',
                      'text-black/35 dark:text-white/45'
                    )}
                  >
                    +{annotations.length - 5} more annotations
                  </div>
                )}
              </div>
            </div>

            {/* Status message */}
            <AnimatePresence>
              {statusMessage && (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={statusMessageVariants}
                  id={statusMessageId}
                  className={classNames('status-message', statusMessage.type)}
                  role={statusMessage.type === 'error' ? 'alert' : 'status'}
                  aria-live={statusMessage.type === 'error' ? 'assertive' : 'polite'}
                >
                  {statusMessage.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div
            className={classNames(
              'flex justify-end gap-2 py-[0.85rem] px-[1.1rem] pb-4 border-t bg-transparent',
              'border-black/8 dark:border-white/8'
            )}
          >
            <button
              className={classNames(
                'py-2 px-4 text-[0.8125rem] font-medium rounded-full border-none cursor-pointer',
                'transition-all duration-150 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                'active:-translate-y-px active:scale-[0.98]',
                'bg-transparent text-black/50 hover:bg-black/5 hover:text-[#1a1a1a] hover:-translate-y-px',
                'dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white'
              )}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={classNames(
                'flex items-center gap-1.5 py-2 px-4 text-[0.8125rem] font-medium rounded-lg border-none cursor-pointer text-white',
                'bg-df-blue',
                'transition-all duration-150 ease-out',
                'hover:enabled:-translate-y-px hover:enabled:shadow-[0_4px_12px_rgba(60,130,247,0.25)]',
                'active:enabled:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                isExporting && 'animate-pulse'
              )}
              type="button"
              onClick={handleExport}
              disabled={isExporting}
            >
              {exportOutcome ? (
                exportOutcome === 'copied' ? '✓ Copied!' : '✓ Downloaded!'
              ) : isExporting ? (
                isClipboardFormat ? 'Copying...' : 'Exporting...'
              ) : (
                <>
                  <IconExport size={16} />
                  {isSnapshotFormat ? 'Download Snapshot' : isMarkdownFormat ? 'Copy Markdown' : 'Export'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ExportModal;
