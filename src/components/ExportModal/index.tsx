import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import type { Annotation, ExportFormat } from '@/types';
import { exportAsImageWithNotes, exportAsSnapshotImage } from '@/utils/export';
import { hasScreenshotPermission, requestScreenshotPermission } from '@/utils/permissions';
import { getCategoryConfig } from '@/shared/categories';
import { IconClose, IconCopy, IconExport, IconImage } from '../Icons';
import styles from './styles.module.scss';

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
        if (result.usedPlaceholder) {
          setStatusMessage({
            type: 'warning',
            text:
              'Snapshot downloaded, but the screenshot was unavailable. Try again or check site restrictions.',
          });
        } else {
          setExportOutcome('downloaded');
          setStatusMessage({ type: 'success', text: 'Snapshot downloaded.' });
          autoCloseTimerRef.current = setTimeout(() => {
            onClose();
          }, 1500);
        }
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

  return (
    <div className={`${styles.overlay} ${lightMode ? styles.lightOverlay : ''}`}>
      <button
        className={styles.overlayDismiss}
        type="button"
        aria-label="Close export dialog"
        onClick={onClose}
      />
      <div
        className={`${styles.modal} ${lightMode ? styles.light : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Export feedback"
        aria-describedby={statusId}
        aria-busy={isExporting}
        ref={modalRef}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Export Feedback</h2>
          <button className={styles.closeButton} type="button" aria-label="Close export dialog" onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total annotations</span>
              <span className={styles.summaryValue}>{annotations.length}</span>
            </div>
          </div>

          {/* Format Selection */}
          <div className={styles.formatSection}>
            <h3 className={styles.formatTitle}>Export Format</h3>
            <div
              className={styles.formatOptions}
              role="radiogroup"
              aria-label="Export format"
              ref={formatOptionsRef}
              onKeyDown={handleFormatKeyDown}
              tabIndex={0}
            >
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`${styles.formatOption} ${selectedFormat === option.id ? styles.selected : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={selectedFormat === option.id}
                  disabled={isExporting}
                  onClick={() => setSelectedFormat(option.id)}
                >
                  <span className={styles.formatIcon}>{option.icon}</span>
                  <div className={styles.formatContent}>
                    <span className={styles.formatLabel}>{option.label}</span>
                    <span className={styles.formatDescription}>{option.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {isSnapshot && (
            <div
              className={`${styles.permissionCallout} ${
                permissionDenied ? styles.permissionError : ''
              }`}
            >
              <div className={styles.permissionText}>
                <span className={styles.permissionTitle}>Screenshot access</span>
                <span className={styles.permissionBody}>
                  Needed to include the page in your snapshot. Long pages can take a few seconds.
                </span>
              </div>
              {permissionDenied && (
                <button
                  className={styles.permissionButton}
                  type="button"
                  onClick={handlePermissionRequest}
                  disabled={isRequestingPermission}
                >
                  {isRequestingPermission ? 'Requesting...' : 'Grant access'}
                </button>
              )}
            </div>
          )}

          <div className={styles.preview}>
            <h3 className={styles.previewTitle}>Preview</h3>
            <div className={styles.previewList}>
              {annotations.slice(0, 5).map((annotation, index) => {
                const config = getCategoryConfig(annotation.category);
                return (
                  <div key={annotation.id} className={styles.previewItem}>
                    <span
                      className={styles.previewIndex}
                      style={{ backgroundColor: config.color }}
                    >
                      {index + 1}
                    </span>
                    <span className={styles.previewElement}>{annotation.element}</span>
                    <span className={styles.previewComment}>{annotation.comment}</span>
                  </div>
                );
              })}
              {annotations.length > 5 && (
                <div className={styles.previewMore}>
                  +{annotations.length - 5} more annotations
                </div>
              )}
            </div>
          </div>

          {statusMessage && (
            <div
              id={statusId}
              className={`${styles.status} ${styles[statusMessage.type]}`}
              role={statusMessage.type === 'error' ? 'alert' : 'status'}
              aria-live={statusMessage.type === 'error' ? 'assertive' : 'polite'}
            >
              {statusMessage.text}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${styles.exportButton} ${isExporting ? styles.exporting : ''}`}
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
      </div>
    </div>
  );
}

export default ExportModal;
