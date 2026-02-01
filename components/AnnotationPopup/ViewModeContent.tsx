import type {Annotation} from '@/types';
import {clsx} from 'clsx';
import {BUTTON_BASE, BUTTON_SECONDARY, ELEMENT_LABEL} from './styles';

interface ViewModeContentProps {
  element: string;
  annotation: Annotation;
  onClose: () => void;
  onDelete: () => void;
}

export function ViewModeContent({
  element,
  annotation,
  onClose,
  onDelete,
}: ViewModeContentProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={ELEMENT_LABEL}>{element}</span>
      </div>

      {/* Comment */}
      <div className="text-sm leading-relaxed py-2 break-words text-black/85 dark:text-white/90">
        {annotation.comment}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-3">
        <button className={BUTTON_SECONDARY} type="button" onClick={onClose}>
          Close
        </button>
        <button
          className={clsx(
            BUTTON_BASE,
            'font-semibold bg-red-500 text-white',
            'hover:bg-red-600 hover:shadow-[0_2px_8px_rgba(239,68,68,0.25)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/50'
          )}
          type="button"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
