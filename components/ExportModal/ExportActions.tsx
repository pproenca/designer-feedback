import type {ReactNode} from 'react';
import {AnimatePresence} from '@/utils/motion';
import {clsx} from 'clsx';
import {Check, ClipboardCopy, Download} from 'lucide-react';
import {StatusMessage} from '../StatusMessage';
import type {ExportStatus} from './ExportContext';

interface ExportActionsProps {
  isExporting: boolean;
  exportOutcome: 'copied' | 'downloaded' | null;
  isClipboardFormat: boolean;
  statusMessage: ExportStatus | null;
  statusMessageId: string | undefined;
  onClose: () => void;
  handleExport: () => Promise<void>;
}

export function ExportActions({
  isExporting,
  exportOutcome,
  isClipboardFormat,
  statusMessage,
  statusMessageId,
  onClose,
  handleExport,
}: ExportActionsProps) {
  const getButtonContent = (): ReactNode => {
    if (exportOutcome) {
      return (
        <>
          <Check size={16} aria-hidden="true" />
          Exported
        </>
      );
    }
    if (isExporting) {
      return 'Exporting…';
    }
    return 'Export feedback';
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
          {!exportOutcome &&
            !isExporting &&
            (isClipboardFormat ? (
              <ClipboardCopy size={16} aria-hidden="true" />
            ) : (
              <Download size={16} aria-hidden="true" />
            ))}
          {getButtonContent()}
        </button>
      </div>
    </>
  );
}
