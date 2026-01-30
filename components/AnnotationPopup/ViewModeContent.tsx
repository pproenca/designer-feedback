import { m, type Variants } from 'framer-motion';
import type { Annotation } from '@/types';
import { clsx } from 'clsx';

const BUTTON_BASE = [
  'px-4 py-2 text-xs font-medium rounded-lg border-none cursor-pointer',
  'transition-interactive',
  'focus-ring',
  'active:scale-[0.98]',
].join(' ');

const BUTTON_SECONDARY = clsx(
  BUTTON_BASE,
  'bg-black/5 text-black/60 hover:bg-black/8 hover:text-black/75',
  'dark:bg-white/8 dark:text-white/70 dark:hover:bg-white/12 dark:hover:text-white/85'
);

const ELEMENT_LABEL = clsx(
  'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
  'text-muted'
);

interface ViewModeContentProps {
  element: string;
  annotation: Annotation;
  isShakeActive: boolean;
  shakeVariants: Variants;
  onClose: () => void;
  onDelete: () => void;
}

export function ViewModeContent({
  element,
  annotation,
  isShakeActive,
  shakeVariants,
  onClose,
  onDelete,
}: ViewModeContentProps) {
  return (
    <m.div variants={shakeVariants} animate={isShakeActive ? 'shake' : undefined}>
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
    </m.div>
  );
}
