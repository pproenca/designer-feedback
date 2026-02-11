import {useMemo, type ReactNode} from 'react';
import {
  m,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from '@/utils/motion';
import type {Annotation} from '@/types';
import {clsx} from 'clsx';
import {usePopupPosition} from './usePopupPosition';
import {ViewModeContent} from './ViewModeContent';
import {CreateModeContent} from './CreateModeContent';

const getPopupVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : {scale: 0.95, y: 4}),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : {scale: 1, y: 0}),
    transition: reduceMotion
      ? {duration: 0.15, ease: 'easeOut'}
      : {
          type: 'spring',
          stiffness: 500,
          damping: 25,
          mass: 0.8,
        },
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : {scale: 0.98, y: -4}),
    transition: {
      duration: reduceMotion ? 0.1 : 0.12,
      ease: 'easeIn',
    },
  },
});

interface PopupShellProps {
  x: number;
  y: number;
  isFixed: boolean;
  ariaLabel: string;
  children: ReactNode;
}

function PopupShell({x, y, isFixed, ariaLabel, children}: PopupShellProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const popupVariants = useMemo(
    () => getPopupVariants(reduceMotion),
    [reduceMotion]
  );
  const position = usePopupPosition({x, y, isFixed});

  const popupStyle = useMemo(
    () =>
      ({
        left: position.x,
        top: position.y,
        position: position.isFixed ? 'fixed' : 'absolute',
      }) as const,
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
        aria-label={ariaLabel}
        tabIndex={-1}
        variants={popupVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}

// --- Create Annotation Popup ---

interface CreateAnnotationPopupProps {
  element: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  x: number;
  y: number;
  isFixed: boolean;
  accentColor?: string;
}

export function CreateAnnotationPopup({
  element,
  selectedText,
  placeholder = 'What should change?…',
  initialValue = '',
  submitLabel = 'Add',
  onSubmit,
  onCancel,
  x,
  y,
  isFixed,
  accentColor = 'var(--color-df-blue)',
}: CreateAnnotationPopupProps) {
  return (
    <PopupShell x={x} y={y} isFixed={isFixed} ariaLabel="Create annotation">
      <CreateModeContent
        element={element}
        selectedText={selectedText}
        placeholder={placeholder}
        initialValue={initialValue}
        submitLabel={submitLabel}
        accentColor={accentColor}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </PopupShell>
  );
}

// --- View Annotation Popup ---

interface ViewAnnotationPopupProps {
  element: string;
  annotation: Annotation;
  onDelete: () => void;
  onCancel: () => void;
  x: number;
  y: number;
  isFixed: boolean;
}

export function ViewAnnotationPopup({
  element,
  annotation,
  onDelete,
  onCancel,
  x,
  y,
  isFixed,
}: ViewAnnotationPopupProps) {
  return (
    <PopupShell x={x} y={y} isFixed={isFixed} ariaLabel="Annotation details">
      <ViewModeContent
        element={element}
        annotation={annotation}
        onClose={onCancel}
        onDelete={onDelete}
      />
    </PopupShell>
  );
}
