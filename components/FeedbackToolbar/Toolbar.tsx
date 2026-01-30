/**
 * Toolbar - The main floating toolbar UI component
 *
 * Reads toolbar state directly from stores and renders controls.
 */

import { useState, useEffect, useCallback, useRef, startTransition, type ReactNode } from 'react';
import { m, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useDraggable, type Position } from '@/hooks/useDraggable';
import { clsx } from 'clsx';
import {
  IconList,
  IconClose,
  IconTrash,
  IconSun,
  IconMoon,
  IconExport,
} from '../Icons';
import { loadToolbarPosition, saveToolbarPosition } from './toolbar-position';
import { useToolbarStore } from '@/stores/toolbar';
import { useAnnotationsStore } from '@/stores/annotations';

// =============================================================================
// Types
// =============================================================================

export interface ToolbarProps {
  /** Callback when theme button is clicked */
  onThemeToggle: () => void;
  /** Whether light mode is enabled */
  lightMode: boolean;
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
  onThemeToggle,
  lightMode,
  children,
}: ToolbarProps) {
  const isExpanded = useToolbarStore((s) => s.isExpanded);
  const addMode = useToolbarStore((s) => s.addMode);
  const isEntranceComplete = useToolbarStore((s) => s.isEntranceComplete);
  const toolbarExpanded = useToolbarStore((s) => s.toolbarExpanded);
  const toolbarCollapsed = useToolbarStore((s) => s.toolbarCollapsed);
  const toggleCategoryPanel = useToolbarStore((s) => s.toggleCategoryPanel);
  const exportModalOpened = useToolbarStore((s) => s.exportModalOpened);
  const annotationDeselected = useToolbarStore((s) => s.annotationDeselected);

  const annotationsCount = useAnnotationsStore((s) => s.annotations.length);
  const annotationsCleared = useAnnotationsStore((s) => s.annotationsCleared);

  const isSelectingElement = addMode === 'selecting';
  const isCategoryPanelOpen = addMode === 'category';

  const [savedToolbarPosition, setSavedToolbarPosition] = useState<Position | null>(null);
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const tooltipDelayTimerRef = useRef<number | null>(null);

  const handleTooltipWarmup = useCallback(() => {
    if (tooltipsReady || tooltipDelayTimerRef.current !== null) return;
    tooltipDelayTimerRef.current = window.setTimeout(() => {
      setTooltipsReady(true);
      tooltipDelayTimerRef.current = null;
    }, 850);
  }, [tooltipsReady]);

  useEffect(() => {
    return () => {
      if (tooltipDelayTimerRef.current !== null) {
        clearTimeout(tooltipDelayTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadInitialPosition = async () => {
      try {
        const position = await loadToolbarPosition();
        if (!isCancelled) {
          setSavedToolbarPosition(position);
        }
      } catch (error) {
        console.error('Failed to load toolbar position:', error);
      }
    };

    loadInitialPosition();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleToolbarPositionChange = useCallback((position: Position) => {
    saveToolbarPosition(position).catch(console.error);
  }, []);

  const handleExpandedChange = useCallback(
    (expanded: boolean) => {
      if (expanded) {
        toolbarExpanded();
      } else {
        toolbarCollapsed();
      }
    },
    [toolbarExpanded, toolbarCollapsed]
  );

  const handleExportClick = useCallback(() => {
    startTransition(() => exportModalOpened());
  }, [exportModalOpened]);

  const handleClearClick = useCallback(async () => {
    await annotationsCleared();
    startTransition(() => annotationDeselected());
  }, [annotationsCleared, annotationDeselected]);
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
    initialPosition: savedToolbarPosition,
    onPositionChange: handleToolbarPositionChange,
  });

  return (
    <div
      className={clsx(
        'fixed top-5 right-5 z-toolbar font-sans pointer-events-none',
        isDragging && 'cursor-grabbing [&_*]:cursor-grabbing'
      )}
      data-toolbar
      data-tooltips-ready={tooltipsReady ? 'true' : 'false'}
      onMouseEnter={handleTooltipWarmup}
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
        className={clsx(
          'select-none flex items-center justify-center pointer-events-auto cursor-default',
          'transition-all duration-200 ease-out',
          'bg-white text-black/85 shadow-toolbar-light',
          'dark:bg-df-dark dark:text-white dark:border dark:border-white/8 dark:shadow-toolbar',
          isExpanded
            ? 'w-auto h-11 rounded-toolbar p-1.5'
            : clsx(
                'w-11 h-11 rounded-full p-0 cursor-pointer',
                'hover:bg-df-surface-subtle dark:hover:bg-df-dark-hover',
                'active:scale-95'
              )
        )}
        onClick={() => !isExpanded && handleExpandedChange(true)}
        onKeyDown={(event) => {
          if (!isExpanded && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            handleExpandedChange(true);
          }
        }}
        onMouseDown={handleToolbarDragMouseDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        {/* Collapsed state: show icon + badge */}
        <div
          className={clsx(
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
          className={clsx(
            'flex items-center gap-1.5 transition duration-200',
            isExpanded
              ? clsx(
                  'opacity-100 scale-100 visible pointer-events-auto',
                  !reduceMotion && 'blur-0'
                )
              : clsx(
                  'opacity-0 scale-60 invisible pointer-events-none',
                  !reduceMotion && 'blur-sm'
                )
          )}
        >
          {/* Add annotation button */}
          <div className="relative flex items-center justify-center group">
            <button
              className={clsx(
                'btn-toolbar',
                (isSelectingElement || isCategoryPanelOpen) && 'active'
              )}
              type="button"
              aria-label={isSelectingElement ? 'Cancel add annotation' : 'Add annotation'}
              aria-pressed={isSelectingElement || isCategoryPanelOpen}
              aria-expanded={isCategoryPanelOpen}
              aria-describedby="tooltip-add-annotation"
              onClick={toggleCategoryPanel}
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
              onClick={handleExportClick}
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
              className={clsx('btn-toolbar', 'danger')}
              type="button"
              aria-label="Clear all annotations"
              aria-describedby="tooltip-clear"
              onClick={handleClearClick}
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
              onClick={() => handleExpandedChange(false)}
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
