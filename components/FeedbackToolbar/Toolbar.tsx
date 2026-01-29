/**
 * Toolbar - The main floating toolbar UI component
 *
 * This is a pure presentation component that renders the toolbar controls.
 * All state management is handled by the parent composition root.
 */

import type { ReactNode } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDraggable, type Position } from '@/hooks/useDraggable';
import { classNames } from '@/utils/classNames';
import {
  IconList,
  IconClose,
  IconTrash,
  IconSun,
  IconMoon,
  IconExport,
} from '../Icons';

// =============================================================================
// Types
// =============================================================================

export interface ToolbarProps {
  /** Whether the toolbar is expanded */
  isExpanded: boolean;
  /** Whether entrance animation is complete */
  isEntranceComplete: boolean;
  /** Number of annotations */
  annotationsCount: number;
  /** Callback when expanded state changes */
  onExpandedChange: (expanded: boolean) => void;
  /** Callback when add button is clicked */
  onAddClick: () => void;
  /** Callback when export button is clicked */
  onExportClick: () => void;
  /** Callback when clear button is clicked */
  onClearClick: () => void;
  /** Callback when theme button is clicked */
  onThemeToggle: () => void;
  /** Whether element selection mode is active */
  isSelectingElement: boolean;
  /** Whether category panel is open */
  isCategoryPanelOpen: boolean;
  /** Whether light mode is enabled */
  lightMode: boolean;
  /** Whether tooltips are ready to show */
  tooltipsReady: boolean;
  /** Callback to warm up tooltips */
  onTooltipWarmup: () => void;
  /** Initial toolbar position */
  initialPosition?: Position | null;
  /** Callback when toolbar position changes */
  onPositionChange?: (position: Position) => void;
  /** Children to render in add button area (CategoryPanel) */
  children?: ReactNode;
}

// =============================================================================
// Animation Variants
// =============================================================================

const getVariants = (reduceMotion: boolean) => ({
  toolbar: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { y: 6, scale: 0.96 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { y: 0, scale: 1 }),
      transition: reduceMotion
        ? { duration: 0.15, ease: 'easeOut' as const }
        : { type: 'spring' as const, stiffness: 400, damping: 25 },
    },
  },
  badge: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.9 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: reduceMotion
        ? { duration: 0.12, ease: 'easeOut' as const }
        : { type: 'spring' as const, stiffness: 500, damping: 20, delay: 0.4 },
    },
  },
  iconSwap: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.8 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: { duration: 0.12, ease: 'easeOut' as const },
    },
    exit: {
      opacity: 0,
      ...(reduceMotion ? {} : { scale: 0.8 }),
      transition: { duration: 0.08, ease: 'easeIn' as const },
    },
  },
});

// =============================================================================
// Component
// =============================================================================

export function Toolbar({
  isExpanded,
  isEntranceComplete,
  annotationsCount,
  onExpandedChange,
  onAddClick,
  onExportClick,
  onClearClick,
  onThemeToggle,
  isSelectingElement,
  isCategoryPanelOpen,
  lightMode,
  tooltipsReady,
  onTooltipWarmup,
  initialPosition,
  onPositionChange,
  children,
}: ToolbarProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const variants = getVariants(reduceMotion);

  const {
    position: toolbarPosition,
    isDragging,
    expandDirection,
    onMouseDown: handleToolbarDragMouseDown,
  } = useDraggable({
    elementWidth: 44,
    elementHeight: 44,
    initialPosition,
    onPositionChange,
  });

  return (
    <div
      className={classNames(
        'fixed top-5 right-5 z-toolbar font-sans pointer-events-none',
        isDragging && 'cursor-grabbing [&_*]:cursor-grabbing'
      )}
      data-toolbar
      data-tooltips-ready={tooltipsReady ? 'true' : 'false'}
      onMouseEnter={onTooltipWarmup}
      style={
        toolbarPosition
          ? expandDirection === 'left'
            ? {
                top: toolbarPosition.y,
                right: window.innerWidth - toolbarPosition.x - 44,
                left: 'auto',
              }
            : {
                top: toolbarPosition.y,
                right: 'auto',
                left: toolbarPosition.x,
              }
          : undefined
      }
    >
      <m.div
        initial={!isEntranceComplete ? 'hidden' : false}
        animate="visible"
        variants={variants.toolbar}
        className={classNames(
          'select-none flex items-center justify-center pointer-events-auto cursor-default',
          'transition-all duration-200 ease-out',
          'bg-white text-black/85 shadow-toolbar-light',
          'dark:bg-df-dark dark:text-white dark:border dark:border-white/8 dark:shadow-toolbar',
          isExpanded
            ? 'w-auto h-11 rounded-toolbar p-1.5'
            : classNames(
                'w-11 h-11 rounded-full p-0 cursor-pointer',
                'hover:bg-df-surface-subtle dark:hover:bg-df-dark-hover',
                'active:scale-95'
              )
        )}
        onClick={() => !isExpanded && onExpandedChange(true)}
        onKeyDown={(event) => {
          if (!isExpanded && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onExpandedChange(true);
          }
        }}
        onMouseDown={handleToolbarDragMouseDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        {/* Collapsed state: show icon + badge */}
        <div
          className={classNames(
            'absolute flex items-center justify-center transition-opacity duration-100',
            isExpanded
              ? 'opacity-0 invisible pointer-events-none'
              : 'opacity-100 visible pointer-events-auto'
          )}
        >
          <IconList size={20} />
          <AnimatePresence>
            {annotationsCount > 0 && (
              <m.span
                initial={!isEntranceComplete ? 'hidden' : false}
                animate="visible"
                exit="hidden"
                variants={variants.badge}
                className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1.25 rounded-full bg-df-blue text-white text-2xs font-semibold flex items-center justify-center shadow-sm"
              >
                {annotationsCount}
              </m.span>
            )}
          </AnimatePresence>
        </div>

        {/* Expanded state: show controls */}
        <div
          className={classNames(
            'flex items-center gap-1.5 transition duration-200',
            isExpanded
              ? classNames(
                  'opacity-100 scale-100 visible pointer-events-auto',
                  !reduceMotion && 'blur-0'
                )
              : classNames(
                  'opacity-0 scale-60 invisible pointer-events-none',
                  !reduceMotion && 'blur-sm'
                )
          )}
        >
          {/* Add annotation button */}
          <div className="relative flex items-center justify-center group">
            <button
              className={classNames(
                'btn-toolbar',
                (isSelectingElement || isCategoryPanelOpen) && 'active'
              )}
              type="button"
              aria-label={isSelectingElement ? 'Cancel add annotation' : 'Add annotation'}
              aria-pressed={isSelectingElement || isCategoryPanelOpen}
              aria-expanded={isCategoryPanelOpen}
              aria-describedby="tooltip-add-annotation"
              onClick={onAddClick}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isSelectingElement ? (
                  <m.span
                    key="close"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={variants.iconSwap}
                    className="flex items-center justify-center"
                  >
                    <IconClose size={18} />
                  </m.span>
                ) : (
                  <m.span
                    key="list"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={variants.iconSwap}
                    className="flex items-center justify-center"
                  >
                    <IconList size={18} />
                  </m.span>
                )}
              </AnimatePresence>
            </button>
            <span className="tooltip" role="tooltip" id="tooltip-add-annotation">
              {isSelectingElement ? 'Cancel' : 'Add annotation'}
            </span>

            {/* Category panel slot */}
            {children}
          </div>

          <div className="toolbar-divider" />

          {/* Export button */}
          <div className="relative flex items-center justify-center group">
            <button
              className="btn-toolbar"
              type="button"
              aria-label="Export feedback"
              aria-describedby="tooltip-export"
              onClick={onExportClick}
              disabled={annotationsCount === 0}
            >
              <IconExport size={18} />
            </button>
            <span className="tooltip" role="tooltip" id="tooltip-export">
              Export feedback
            </span>
          </div>

          <div className="toolbar-divider" />

          {/* Clear button */}
          <div className="relative flex items-center justify-center group">
            <button
              className={classNames('btn-toolbar', 'danger')}
              type="button"
              aria-label="Clear all annotations"
              aria-describedby="tooltip-clear"
              onClick={onClearClick}
              disabled={annotationsCount === 0}
            >
              <IconTrash size={18} />
            </button>
            <span className="tooltip" role="tooltip" id="tooltip-clear">
              Clear all
            </span>
          </div>

          <div className="toolbar-divider" />

          {/* Theme toggle */}
          <div className="relative flex items-center justify-center group">
            <button
              className="btn-toolbar"
              type="button"
              aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-describedby="tooltip-theme"
              onClick={onThemeToggle}
            >
              <AnimatePresence mode="wait" initial={false}>
                {lightMode ? (
                  <m.span
                    key="moon"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={variants.iconSwap}
                    className="flex items-center justify-center"
                  >
                    <IconMoon size={18} />
                  </m.span>
                ) : (
                  <m.span
                    key="sun"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={variants.iconSwap}
                    className="flex items-center justify-center"
                  >
                    <IconSun size={18} />
                  </m.span>
                )}
              </AnimatePresence>
            </button>
            <span className="tooltip" role="tooltip" id="tooltip-theme">
              {lightMode ? 'Dark mode' : 'Light mode'}
            </span>
          </div>

          {/* Collapse button */}
          <div className="relative flex items-center justify-center group">
            <button
              className="btn-toolbar"
              type="button"
              aria-label="Minimize toolbar"
              aria-describedby="tooltip-minimize"
              onClick={() => onExpandedChange(false)}
            >
              <IconClose size={18} />
            </button>
            <span className="tooltip" role="tooltip" id="tooltip-minimize">
              Minimize
            </span>
          </div>
        </div>
      </m.div>
    </div>
  );
}
