import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { Annotation, ExportFormat } from '@/types';
import { exportAsImageWithNotes, exportAsSnapshotImage } from '@/utils/export';
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
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('snapshot');
  const isMarkdown = selectedFormat === 'image-notes';
  const isSnapshot = selectedFormat === 'snapshot';
  const isClipboardExport = isMarkdown;

  // Store timer ID for cleanup on unmount
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current !== null) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setExportOutcome(null);
    try {
      if (selectedFormat === 'snapshot') {
        await exportAsSnapshotImage(annotations);
        setExportOutcome('downloaded');
      } else {
        await exportAsImageWithNotes(annotations);
        setExportOutcome('copied');
      }
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onClose();
  };

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close export dialog"
    >
      <div
        className={`${styles.modal} ${lightMode ? styles.light : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Export feedback"
        tabIndex={-1}
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
            <div className={styles.formatOptions} role="radiogroup" aria-label="Export format">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`${styles.formatOption} ${selectedFormat === option.id ? styles.selected : ''}`}
                  type="button"
                  role="radio"
                  aria-checked={selectedFormat === option.id}
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
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${styles.exportButton} ${isExporting ? styles.exporting : ''}`}
            type="button"
            onClick={handleExport}
            disabled={isExporting || exportOutcome !== null}
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
