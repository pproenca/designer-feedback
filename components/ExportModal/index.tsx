import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
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

function cn(...classes: (string | boolean | undefined | null)[]): string {
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
      duration: 0.35,
      ease: [0.19, 1, 0.22, 1],
    },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.98,
    transition: { duration: 0.15, ease: 'easeIn' },
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

type FormatOption = {
  id: ExportFormat;
  label: string;
  description: string;
  icon: ReactNode;
};

const FORMAT_OPTIONS: FormatOption[] = [
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
  const [isExporting, setIsExporting] = useState(false);
  const [exportOutcome, setExportOutcome] = useState<'copied' | 'downloaded' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'warning' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('snapshot');
  const isMarkdown = selectedFormat === 'image-notes';
  const isSnapshot = selectedFormat === 'snapshot';
  const isClipboardExport = isMarkdown;

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

  const getOriginPattern = (): string | undefined => {
    try {
      const origin = window.location.origin;
      if (!origin || origin === 'null') return undefined;
      return `${origin}/*`;
    } catch {
      return undefined;
    }
  };

  useEffect(() => {
    setStatusMessage(null);
    setExportOutcome(null);
    if (selectedFormat !== 'snapshot') {
      setPermissionDenied(false);
      return;
    }

    let cancelled = false;
    const origin = getOriginPattern();
    hasScreenshotPermission(origin).then((granted) => {
      if (!cancelled) {
        setPermissionDenied(!granted);
      }
    });
    return () => {
      cancelled = true;
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
    setIsRequestingPermission(true);
    setStatusMessage(null);

    const origin = getOriginPattern();
    const granted = await requestScreenshotPermission(origin);
    setIsRequestingPermission(false);
    if (granted) {
      setPermissionDenied(false);
      setStatusMessage({
        type: 'success',
        text: 'Permission granted. You can export the snapshot now.',
      });
    } else {
      setPermissionDenied(true);
      setStatusMessage({
        type: 'error',
        text: 'Permission is required to capture screenshots. Please grant access to continue.',
      });
    }
  };

  const handleExport = async () => {
    if (autoCloseTimerRef.current !== null) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setIsExporting(true);
    setExportOutcome(null);
    setStatusMessage({
      type: 'info',
      text: selectedFormat === 'snapshot' ? 'Capturing full page...' : 'Preparing export...',
    });
    try {
      if (selectedFormat === 'snapshot') {
        const origin = getOriginPattern();
        const hasPermission = await requestScreenshotPermission(origin);
        if (!hasPermission) {
          setPermissionDenied(true);
          setStatusMessage({
            type: 'error',
            text: 'Screenshot permission is required. Click "Grant access" and try again.',
          });
          return;
        }
        setPermissionDenied(false);
        const result = await exportAsSnapshotImage(annotations, { hasPermission });
        if (result.captureMode === 'full') {
          setExportOutcome('downloaded');
          setStatusMessage({ type: 'success', text: 'Snapshot downloaded.' });
          autoCloseTimerRef.current = setTimeout(() => {
            onClose();
          }, 1500);
          return;
        }

        setStatusMessage({
          type: 'warning',
          text:
            result.captureMode === 'viewport'
              ? 'Snapshot downloaded, but only the visible area was captured. Try again or reduce page length.'
              : 'Snapshot downloaded, but the screenshot was unavailable. Try again or check site restrictions.',
        });
      } else {
        await exportAsImageWithNotes(annotations);
        setExportOutcome('copied');
        setStatusMessage({ type: 'success', text: 'Markdown copied to clipboard.' });
        autoCloseTimerRef.current = setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setStatusMessage({ type: 'error', text: getReadableError(error) });
    } finally {
      setIsExporting(false);
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

    const currentIndex = FORMAT_OPTIONS.findIndex((option) => option.id === selectedFormat);
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length;
    const nextOption = FORMAT_OPTIONS[nextIndex];
    setSelectedFormat(nextOption.id);
    buttons[nextIndex]?.focus();
  };

  const statusId = statusMessage ? 'df-export-status' : undefined;

  // CSS variable styles for modal theming
  const modalCssVars = lightMode
    ? {
        '--modal-bg': '#ffffff',
        '--modal-surface': '#f4f4f5',
        '--modal-surface-2': '#ededf0',
        '--modal-surface-3': '#e6e6ea',
        '--modal-text': '#1a1a1a',
        '--modal-text-muted': 'rgba(0, 0, 0, 0.55)',
        '--modal-border': 'rgba(0, 0, 0, 0.08)',
      }
    : {
        '--modal-bg': '#151515',
        '--modal-surface': '#1c1c1c',
        '--modal-surface-2': '#222222',
        '--modal-surface-3': '#2a2a2a',
        '--modal-text': '#ffffff',
        '--modal-text-muted': 'rgba(255, 255, 255, 0.6)',
        '--modal-border': 'rgba(255, 255, 255, 0.08)',
      };

  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          'fixed inset-0 flex items-center justify-center z-[100010]',
          !lightMode && 'bg-[rgba(10,10,10,0.82)]',
          lightMode && 'bg-[rgba(250,250,250,0.88)]'
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
          className={cn(
            'relative z-[1] rounded-[18px] w-[90%] max-w-[400px] max-h-[80vh] overflow-hidden',
            'flex flex-col font-sans',
            !lightMode && 'bg-[#151515] shadow-[0_18px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.08)]',
            lightMode && 'bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.06)]'
          )}
          style={modalCssVars as CSSProperties}
          role="dialog"
          aria-modal="true"
          aria-label="Export feedback"
          aria-describedby={statusId}
          aria-busy={isExporting}
          ref={modalRef}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Header */}
          <div
            className={cn(
              'flex items-center justify-between py-[0.95rem] px-[1.1rem] pb-[0.8rem]',
              'border-b',
              !lightMode && 'border-white/8',
              lightMode && 'border-black/8'
            )}
          >
            <h2
              className={cn(
                'text-[1.05rem] font-semibold m-0 tracking-[0.01em]',
                !lightMode && 'text-white',
                lightMode && 'text-[#1a1a1a]'
              )}
            >
              Export Feedback
            </h2>
            <button
              className={cn(
                'flex items-center justify-center w-7 h-7 border-none rounded-md bg-transparent cursor-pointer',
                'transition-all duration-150 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                !lightMode && 'text-white/55 hover:bg-white/8 hover:text-white hover:-translate-y-px',
                lightMode && 'text-black/40 hover:bg-black/5 hover:text-[#1a1a1a] hover:-translate-y-px'
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
                  className={cn(
                    'text-[0.8125rem] tracking-[0.04em]',
                    !lightMode && 'text-white/60',
                    lightMode && 'text-black/50'
                  )}
                >
                  Total annotations
                </span>
                <span
                  className={cn(
                    'text-[0.82rem] font-semibold p-0 bg-none border-none',
                    !lightMode && 'text-white',
                    lightMode && 'text-[#1a1a1a]'
                  )}
                >
                  {annotations.length}
                </span>
              </div>
            </div>

            {/* Format Selection */}
            <div className="mb-[0.9rem]">
              <h3
                className={cn(
                  'text-xs font-medium mb-[0.6rem] tracking-[0.04em]',
                  !lightMode && 'text-white/55',
                  lightMode && 'text-black/40'
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
                {FORMAT_OPTIONS.map((option) => {
                  const isSelected = selectedFormat === option.id;
                  return (
                    <button
                      key={option.id}
                      className={cn(
                        'flex items-start gap-3 py-[0.8rem] px-[0.9rem] bg-transparent border rounded-[10px]',
                        'cursor-pointer text-left relative',
                        'transition-all duration-150 ease-out',
                        'active:scale-[0.99]',
                        'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                        // Not selected
                        !isSelected && !lightMode && 'border-transparent hover:bg-[#1c1c1c]',
                        !isSelected && lightMode && 'border-transparent hover:bg-[#f4f4f5]',
                        // Selected - dark mode
                        isSelected && !lightMode && 'bg-[#1c1c1c] border-white/8 border-l-2 border-l-df-blue',
                        // Selected - light mode
                        isSelected && lightMode && 'bg-[#f4f4f5] border-black/8 border-l-2 border-l-df-blue'
                      )}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={isExporting}
                      onClick={() => setSelectedFormat(option.id)}
                    >
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-8 h-8 rounded-[10px] leading-none',
                          'border',
                          // Not selected - dark mode
                          !isSelected && !lightMode && 'bg-[#2a2a2a] border-white/8 text-white/85',
                          // Not selected - light mode
                          !isSelected && lightMode && 'bg-black/[0.06] border-black/8 text-black/70',
                          // Selected - dark mode
                          isSelected && !lightMode && 'bg-df-blue/[0.12] border-df-blue/[0.22] text-[#d5e3ff]',
                          // Selected - light mode
                          isSelected && lightMode && 'bg-df-blue/10 border-df-blue/20 text-df-blue'
                        )}
                      >
                        {option.icon}
                      </span>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span
                          className={cn(
                            'text-sm font-medium',
                            !lightMode && 'text-white',
                            lightMode && 'text-[#1a1a1a]'
                          )}
                        >
                          {option.label}
                        </span>
                        <span
                          className={cn(
                            'text-[0.72rem] leading-[1.35]',
                            !lightMode && 'text-white/60',
                            lightMode && 'text-black/50'
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
            {isSnapshot && (
              <div
                className={cn(
                  'flex items-center justify-between gap-3 py-[0.7rem] px-[0.8rem] mb-[0.9rem] rounded-xl border',
                  !lightMode && !permissionDenied && 'bg-[#1c1c1c] border-white/8',
                  lightMode && !permissionDenied && 'bg-[#f4f4f5] border-black/8',
                  permissionDenied && !lightMode && 'bg-red-500/[0.12] border-red-500/50',
                  permissionDenied && lightMode && 'bg-red-600/[0.08] border-red-600/[0.35]'
                )}
              >
                <div className="flex flex-col gap-0.5 flex-1">
                  <span
                    className={cn(
                      'text-[0.78rem] font-semibold tracking-[0.02em]',
                      !lightMode && 'text-white',
                      lightMode && 'text-[#1a1a1a]'
                    )}
                  >
                    Screenshot access
                  </span>
                  <span
                    className={cn(
                      'text-[0.72rem] leading-[1.4]',
                      !lightMode && 'text-white/60',
                      lightMode && 'text-black/55'
                    )}
                  >
                    Needed to include the page in your snapshot. Long pages can take a few seconds.
                  </span>
                </div>
                {permissionDenied && (
                  <button
                    className={cn(
                      'py-[0.45rem] px-3 rounded-full border text-[0.72rem] font-semibold cursor-pointer',
                      'transition-all duration-150 ease-out',
                      'hover:enabled:-translate-y-px active:enabled:scale-[0.98]',
                      'disabled:opacity-60 disabled:cursor-not-allowed',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                      !lightMode && 'bg-df-blue/[0.18] border-df-blue/[0.35] text-[#d5e3ff] hover:enabled:bg-df-blue/[0.28]',
                      lightMode && 'bg-blue-600/[0.12] border-blue-600/[0.35] text-blue-800 hover:enabled:bg-blue-600/[0.18]'
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
                className={cn(
                  'text-xs font-medium mb-[0.55rem] tracking-[0.04em]',
                  !lightMode && 'text-white/55',
                  lightMode && 'text-black/40'
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
                      className={cn(
                        'flex items-center gap-2 text-[0.8rem] py-[0.35rem] px-[0.45rem] rounded-lg bg-transparent border-none',
                        'transition-colors duration-150 ease-out',
                        !lightMode && 'hover:bg-[#1c1c1c]',
                        lightMode && 'hover:bg-[#f4f4f5]'
                      )}
                    >
                      <span
                        className="flex items-center justify-center w-[18px] h-[18px] rounded-full text-[0.625rem] font-semibold text-white shrink-0 shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
                        style={{ backgroundColor: config.color }}
                      >
                        {index + 1}
                      </span>
                      <span
                        className={cn(
                          'whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]',
                          !lightMode && 'text-white/85',
                          lightMode && 'text-black/75'
                        )}
                      >
                        {annotation.element}
                      </span>
                      <span
                        className={cn(
                          'whitespace-nowrap overflow-hidden text-ellipsis flex-1',
                          !lightMode && 'text-white/55',
                          lightMode && 'text-black/45'
                        )}
                      >
                        {annotation.comment}
                      </span>
                    </div>
                  );
                })}
                {annotations.length > 5 && (
                  <div
                    className={cn(
                      'text-xs italic pt-1',
                      !lightMode && 'text-white/45',
                      lightMode && 'text-black/35'
                    )}
                  >
                    +{annotations.length - 5} more annotations
                  </div>
                )}
              </div>
            </div>

            {/* Status message */}
            {statusMessage && (
              <div
                id={statusId}
                className={cn(
                  'mt-[0.6rem] py-[0.6rem] px-3 rounded-[10px] text-xs leading-[1.4] border',
                  // Success
                  statusMessage.type === 'success' && !lightMode && 'text-[#bff1c9] bg-green-500/[0.16] border-green-500/[0.35]',
                  statusMessage.type === 'success' && lightMode && 'text-green-800 bg-green-600/[0.12] border-green-600/30',
                  // Warning
                  statusMessage.type === 'warning' && !lightMode && 'text-[#fde68a] bg-amber-500/[0.18] border-amber-500/[0.35]',
                  statusMessage.type === 'warning' && lightMode && 'text-amber-800 bg-amber-500/[0.14] border-amber-500/30',
                  // Error
                  statusMessage.type === 'error' && !lightMode && 'text-[#fecaca] bg-red-500/[0.18] border-red-500/40',
                  statusMessage.type === 'error' && lightMode && 'text-red-800 bg-red-600/[0.12] border-red-600/30',
                  // Info
                  statusMessage.type === 'info' && !lightMode && 'text-white/75 bg-blue-500/[0.12] border-blue-500/30',
                  statusMessage.type === 'info' && lightMode && 'text-black/65 bg-blue-600/10 border-blue-600/25'
                )}
                role={statusMessage.type === 'error' ? 'alert' : 'status'}
                aria-live={statusMessage.type === 'error' ? 'assertive' : 'polite'}
              >
                {statusMessage.text}
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            className={cn(
              'flex justify-end gap-2 py-[0.85rem] px-[1.1rem] pb-4 border-t bg-transparent',
              !lightMode && 'border-white/8',
              lightMode && 'border-black/8'
            )}
          >
            <button
              className={cn(
                'py-2 px-4 text-[0.8125rem] font-medium rounded-full border-none cursor-pointer',
                'transition-all duration-150 ease-out',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                'active:-translate-y-px active:scale-[0.98]',
                !lightMode && 'bg-transparent text-white/45 hover:bg-white/[0.06] hover:text-white hover:-translate-y-px',
                lightMode && 'bg-transparent text-black/50 hover:bg-black/5 hover:text-[#1a1a1a] hover:-translate-y-px'
              )}
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={cn(
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
                isClipboardExport ? 'Copying...' : 'Exporting...'
              ) : (
                <>
                  <IconExport size={16} />
                  {isSnapshot ? 'Download Snapshot' : isMarkdown ? 'Copy Markdown' : 'Export'}
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
