import {m, AnimatePresence, useReducedMotion} from 'framer-motion';
import {useElementSelection} from './useElementSelection';
import {clsx} from 'clsx';

export interface SelectionOverlayProps {
  enabled: boolean;
}

const getVariants = (reduceMotion: boolean) => ({
  highlight: {
    hidden: {opacity: 0, ...(reduceMotion ? {} : {scale: 0.98})},
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : {scale: 1}),
      transition: {duration: 0.12, ease: 'easeOut' as const},
    },
  },
  tooltip: {
    hidden: {opacity: 0, ...(reduceMotion ? {} : {scale: 0.95, y: 4})},
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : {scale: 1, y: 0}),
      transition: {duration: 0.1, ease: 'easeOut' as const},
    },
  },
});

export function SelectionOverlay({enabled}: SelectionOverlayProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);

  const {
    hoverInfo,
    hasTarget,
    highlightX,
    highlightY,
    highlightWidth,
    highlightHeight,
    tooltipX,
    tooltipY,
  } = useElementSelection({enabled});

  return (
    <AnimatePresence>
      {enabled && hasTarget && hoverInfo ? (
        <div
          className="fixed inset-0 z-overlay pointer-events-none"
          data-selection-overlay
        >
          {/* Highlight box */}
          <m.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={variants.highlight}
            className={clsx(
              'fixed border-2 border-df-blue/50 rounded bg-df-blue/4',
              'pointer-events-none box-border'
            )}
            style={{
              left: highlightX,
              top: highlightY,
              width: highlightWidth,
              height: highlightHeight,
            }}
            data-selection-highlight
          />

          {/* Element tooltip */}
          <m.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={variants.tooltip}
            className={clsx(
              'fixed text-xs font-medium text-white',
              'bg-black/85 py-1.5 px-2.5 rounded-md',
              'pointer-events-none whitespace-nowrap',
              'max-w-50 overflow-hidden text-ellipsis'
            )}
            style={{
              left: tooltipX,
              top: tooltipY,
            }}
            data-selection-tooltip
          >
            {hoverInfo.element}
          </m.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
