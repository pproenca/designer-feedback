import { useState, type ReactNode } from 'react';
import type { Annotation, ExportFormat } from '@/types';
import { exportAsHTML, exportAsImageWithNotes } from '@/utils/export';
import { getCategoryConfig } from '@/shared/categories';
import { IconClose, IconExport, IconGlobe, IconImage } from '../Icons';
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
    id: 'html',
    label: 'Interactive HTML',
    description: 'Single file with hoverable markers. Opens in any browser.',
    icon: <IconGlobe size={18} />,
  },
  {
    id: 'image-notes',
    label: 'Markdown Notes',
    description: 'Markdown report only. Great for sharing in docs.',
    icon: <IconImage size={18} />,
  },
];

export function ExportModal({ annotations, onClose, lightMode = false }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('html');

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (selectedFormat === 'html') {
        await exportAsHTML(annotations);
      } else {
        await exportAsImageWithNotes(annotations);
      }
      setExportComplete(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${lightMode ? styles.light : ''}`}
        onClick={(e) => e.stopPropagation()}
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
            disabled={isExporting || exportComplete}
          >
            {exportComplete ? (
              '✓ Downloaded!'
            ) : isExporting ? (
              'Exporting...'
            ) : (
              <>
                <IconExport size={16} />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
