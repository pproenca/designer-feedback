import {m, AnimatePresence, useReducedMotion} from 'framer-motion';
import {Bug, Lightbulb, CircleHelp, Accessibility} from 'lucide-react';
import {useToolbarActions, useToolbarState} from './ToolbarStateProvider';

const getVariants = (reduceMotion: boolean) => ({
  panel: {
    hidden: {opacity: 0, ...(reduceMotion ? {} : {scale: 0.95, y: -8})},
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : {scale: 1, y: 0}),
      transition: {duration: 0.15, ease: 'easeOut' as const},
    },
    exit: {
      opacity: 0,
      ...(reduceMotion ? {} : {scale: 0.95, y: -8}),
      transition: {duration: 0.1, ease: 'easeIn' as const},
    },
  },
});

export function CategoryPanel() {
  const {addMode} = useToolbarState();
  const {categorySelected} = useToolbarActions();
  const isOpen = addMode === 'category';
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={variants.panel}
          className="category-panel"
          data-category-panel
        >
          <button
            className="category-panel-item focus-ring"
            type="button"
            onClick={() => categorySelected('bug')}
            data-category="bug"
            aria-label="Bug"
          >
            <Bug size={20} aria-hidden="true" />
            <span>Bug</span>
          </button>
          <button
            className="category-panel-item focus-ring"
            type="button"
            onClick={() => categorySelected('question')}
            data-category="question"
            aria-label="Question"
          >
            <CircleHelp size={20} aria-hidden="true" />
            <span>Question</span>
          </button>
          <button
            className="category-panel-item focus-ring"
            type="button"
            onClick={() => categorySelected('suggestion')}
            data-category="suggestion"
            aria-label="Suggestion"
          >
            <Lightbulb size={20} aria-hidden="true" />
            <span>Suggestion</span>
          </button>
          <button
            className="category-panel-item focus-ring"
            type="button"
            onClick={() => categorySelected('accessibility')}
            data-category="accessibility"
            aria-label="Accessibility"
          >
            <Accessibility size={20} aria-hidden="true" />
            <span>Accessibility</span>
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
