import {
  useCallback,
  useMemo,
} from 'react';
import { m, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { Annotation } from '@/types';
import { clsx } from 'clsx';
import { usePopupPosition } from './usePopupPosition';
import { ViewModeContent } from './ViewModeContent';
import { CreateModeContent } from './CreateModeContent';

// =============================================================================
// Framer Motion Variants
// =============================================================================

const getPopupVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : { scale: 0.95, y: 4 }),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : { scale: 1, y: 0 }),
    transition: reduceMotion
      ? { duration: 0.15, ease: 'easeOut' }
      : {
          type: 'spring',
          stiffness: 500,
          damping: 25,
          mass: 0.8,
        },
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : { scale: 0.98, y: -4 }),
    transition: {
      duration: reduceMotion ? 0.1 : 0.12,
      ease: 'easeIn',
    },
  },
});

// =============================================================================
// Types
// =============================================================================

interface AnnotationPopupProps {
  mode?: 'create' | 'view';
  element: string;
  annotation?: Annotation;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit?: (text: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
  x: number;
  y: number;
  isFixed: boolean;
  accentColor?: string;
}

// =============================================================================
// Component
// =============================================================================

export function AnnotationPopup({
  mode = 'create',
  element,
  annotation,
  selectedText,
  placeholder = 'What should change?…',
  initialValue = '',
  submitLabel = 'Add',
  onSubmit,
  onDelete,
  onCancel,
  x,
  y,
  isFixed,
  accentColor = 'var(--color-df-blue)',
}: AnnotationPopupProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const popupVariants = useMemo(() => getPopupVariants(reduceMotion), [reduceMotion]);
  const position = usePopupPosition({ x, y, isFixed });

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleSubmit = useCallback(
    (text: string) => {
      if (!onSubmit) return;
      onSubmit(text);
    },
    [onSubmit]
  );

  const popupStyle = useMemo(
    () => ({
      left: position.x,
      top: position.y,
      position: position.isFixed ? 'fixed' : 'absolute',
    } as const),
    [position.x, position.y, position.isFixed]
  );

  const popupClassName = clsx(
    'w-75 -translate-x-1/2 z-panel',
    'px-4 pt-3 pb-3.5 rounded-2xl',
    'font-sans cursor-default',
    'bg-white shadow-panel-light',
    'dark:bg-df-dark dark:shadow-panel'
  );

  return (
    <AnimatePresence mode="wait">
      <m.div
        className={popupClassName}
        data-annotation-popup
        style={popupStyle}
        role="dialog"
        aria-label={mode === 'view' ? 'Annotation details' : 'Create annotation'}
        tabIndex={-1}
        variants={popupVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {mode === 'view' && annotation ? (
          <ViewModeContent
            element={element}
            annotation={annotation}
            onClose={handleCancel}
            onDelete={onDelete ?? (() => {})}
          />
        ) : (
          <CreateModeContent
            element={element}
            selectedText={selectedText}
            placeholder={placeholder}
            initialValue={initialValue}
            submitLabel={submitLabel}
            accentColor={accentColor}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        )}
      </m.div>
    </AnimatePresence>
  );
}
