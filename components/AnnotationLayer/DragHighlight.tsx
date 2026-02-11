import {m, AnimatePresence, useReducedMotion} from '@/utils/motion';
import {clsx} from 'clsx';
import type {Annotation} from '@/types';

export interface DragHighlightProps {
  annotation: Annotation | null;

  visible: boolean;
}

const getVariants = (reduceMotion: boolean) => ({
  hidden: {opacity: 0, ...(reduceMotion ? {} : {scale: 0.98})},
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : {scale: 1}),
    transition: {duration: 0.12, ease: 'easeOut' as const},
  },
});

export function DragHighlight({annotation, visible}: DragHighlightProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);

  const shouldRender = visible && annotation && annotation.boundingBox;

  return (
    <AnimatePresence>
      {shouldRender && annotation.boundingBox ? (
        <m.div
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={variants}
          className={clsx(
            'border-2 border-dashed border-df-blue/60 rounded bg-df-blue/8',
            'pointer-events-none box-border z-overlay',
            annotation.isFixed ? 'fixed' : 'absolute'
          )}
          style={{
            left: `${annotation.boundingBox.x}px`,
            top: `${annotation.boundingBox.y}px`,
            width: `${annotation.boundingBox.width}px`,
            height: `${annotation.boundingBox.height}px`,
          }}
          data-drag-highlight
        />
      ) : null}
    </AnimatePresence>
  );
}
