import { useState } from 'react';
import type { Annotation } from '@/types';
import { exportFeedback, getCategorySummary } from '@/utils/export';
import { getCategoryConfig, CATEGORIES } from '@/shared/categories';
import { IconClose, IconExport } from '../Icons';
import { CategoryBadge } from '../CategorySelector';
import styles from './styles.module.scss';

interface ExportModalProps {
  annotations: Annotation[];
  onClose: () => void;
  lightMode?: boolean;
}

export function ExportModal({ annotations, onClose, lightMode = false }: ExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const summary = getCategorySummary(annotations);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportFeedback(annotations);
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
          <button className={styles.closeButton} onClick={onClose}>
            <IconClose size={18} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.summary}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total annotations</span>
              <span className={styles.summaryValue}>{annotations.length}</span>
            </div>

            <div className={styles.categories}>
              {CATEGORIES.map((category) => {
                const count = summary[category.id];
                if (count === 0) return null;
                return (
                  <div key={category.id} className={styles.categoryItem}>
                    <CategoryBadge category={category.id} size="small" />
                    <span className={styles.categoryCount}>{count}</span>
                  </div>
                );
              })}
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

          <div className={styles.info}>
            <p>
              Your feedback will be exported as a ZIP file containing:
            </p>
            <ul>
              <li><strong>feedback.json</strong> - Structured data for developers</li>
              <li><strong>feedback.md</strong> - Markdown report with summary</li>
              <li><strong>screenshots/</strong> - Element screenshots</li>
            </ul>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${styles.exportButton} ${isExporting ? styles.exporting : ''}`}
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
                Download ZIP
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
