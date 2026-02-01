

import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { clsx } from 'clsx';
import type { PendingAnnotation } from '@/components/FeedbackToolbar/context';
import type { FeedbackCategory } from '@/types';
import { getCategoryConfig } from '@/shared/categories';

export interface PendingMarkerProps {
  pendingAnnotation: PendingAnnotation | null;
  markerNumber: number;
  category: FeedbackCategory;
}

const getVariants = (reduceMotion: boolean) => ({
  marker: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.9 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: reduceMotion
        ? { duration: 0.12, ease: 'easeOut' as const }
        : { type: 'spring' as const, stiffness: 400, damping: 20 },
    },
  },
});

export function PendingMarker({ pendingAnnotation, markerNumber, category }: PendingMarkerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);
  const categoryConfig = getCategoryConfig(category);

  if (!pendingAnnotation) {
    return null;
  }

  const { x, y, rect, isFixed } = pendingAnnotation;




  const displayY = isFixed ? rect.top + rect.height / 2 : y;

  return (
    <AnimatePresence>
      <m.div
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={variants.marker}
        className={clsx(
          'w-5.5 h-5.5 rounded-full flex items-center justify-center',
          'text-xs font-semibold text-white select-none',
          `shadow-marker -translate-x-1/2 -translate-y-1/2 ${categoryConfig.tw.bg}`
        )}
        style={{
          left: `${x}px`,
          top: `${displayY}px`,
          position: isFixed ? 'fixed' : 'absolute',
        }}
        data-pending-marker
      >
        {markerNumber}
      </m.div>
    </AnimatePresence>
  );
}
