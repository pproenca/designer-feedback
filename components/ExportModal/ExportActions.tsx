import type {ReactNode} from 'react';
import {AnimatePresence} from 'framer-motion';
import {clsx} from 'clsx';
import {Check, Download} from 'lucide-react';
import {StatusMessage} from '../StatusMessage';
import {useExportState, useExportActions} from './ExportContext';

export function ExportActions() {
  const {
    isExporting,
    exportOutcome,
    isSnapshotFormat,
    isMarkdownFormat,
    isClipboardFormat,
    statusMessage,
    statusMessageId,
  } = useExportState();
  const {onClose, handleExport} = useExportActions();
  const getButtonContent = (): ReactNode => {
    if (exportOutcome) {
      return (
        <>
          <Check size={16} aria-hidden="true" />
          {exportOutcome === 'copied' ? 'Copied!' : 'Downloaded!'}
        </>
      );
    }
    if (isExporting) {
      return isClipboardFormat ? 'Copying…' : 'Exporting…';
    }
    if (isSnapshotFormat) return 'Download Snapshot';
    if (isMarkdownFormat) return 'Copy Markdown';
    return 'Export';
  };

  return (
    <>
      {/* Status message */}
      <AnimatePresence>
        {statusMessage && (
          <div className="px-4.5 pb-2">
            <StatusMessage
              type={statusMessage.type}
              message={statusMessage.text}
              id={statusMessageId}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div
        className={clsx(
          'flex justify-end gap-2.5 py-4 px-4.5 pb-4.5 border-t',
          'border-black/8 dark:border-white/8'
        )}
      >
        <button
          className={clsx(
            'py-2 px-4 text-sm font-medium rounded-lg border-none cursor-pointer',
            'transition-interactive',
            'focus-ring',
            'active:scale-[0.97]',
            'bg-transparent text-muted-soft hover:bg-black/5 hover:text-df-ink',
            'dark:hover:bg-white/5 dark:hover:text-white'
          )}
          type="button"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className={clsx(
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
          {!exportOutcome && !isExporting && (
            <Download size={16} aria-hidden="true" />
          )}
          {getButtonContent()}
        </button>
      </div>
    </>
  );
}
