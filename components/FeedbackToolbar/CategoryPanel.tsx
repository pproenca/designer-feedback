/**
 * CategoryPanel - Category selection dropdown for annotations
 *
 * This component renders the category selection panel that appears
 * when the user clicks the add annotation button.
 */

import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  IconBug,
  IconLightbulb,
  IconQuestion,
  IconAccessibility,
} from '../Icons';
import { useToolbarStore } from '@/stores/toolbar';

// =============================================================================
// Animation Variants
// =============================================================================

const getVariants = (reduceMotion: boolean) => ({
  panel: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: -8 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1, y: 0 }),
      transition: { duration: 0.15, ease: 'easeOut' as const },
    },
    exit: {
      opacity: 0,
      ...(reduceMotion ? {} : { scale: 0.95, y: -8 }),
      transition: { duration: 0.1, ease: 'easeIn' as const },
    },
  },
});

// =============================================================================
// Component
// =============================================================================

export function CategoryPanel() {
  const isOpen = useToolbarStore((s) => s.addMode === 'category');
  const categorySelected = useToolbarStore((s) => s.categorySelected);
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
            <IconBug size={20} aria-hidden="true" />
            <span>Bug</span>
          </button>
          <button
            className="category-panel-item focus-ring"
            type="button"
            onClick={() => categorySelected('question')}
            data-category="question"
            aria-label="Question"
          >
            <IconQuestion size={20} aria-hidden="true" />
            <span>Question</span>
          </button>
          <button
            className="category-panel-item focus-ring"
            type="button"
            onClick={() => categorySelected('suggestion')}
            data-category="suggestion"
            aria-label="Suggestion"
          >
            <IconLightbulb size={20} aria-hidden="true" />
            <span>Suggestion</span>
          </button>
          <button
            className="category-panel-item focus-ring"
            type="button"
            onClick={() => categorySelected('accessibility')}
            data-category="accessibility"
            aria-label="Accessibility"
          >
            <IconAccessibility size={20} aria-hidden="true" />
            <span>Accessibility</span>
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
