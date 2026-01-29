import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  lazy,
  Suspense,
  startTransition,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { m, AnimatePresence, useMotionValue, useReducedMotion } from 'framer-motion';

import { AnnotationPopup } from '../AnnotationPopup';
import { useDraggable, type Position } from '@/hooks/useDraggable';
import { onUiEvent } from '@/utils/ui-events';
import { loadToolbarPosition, saveToolbarPosition } from './toolbar-position';
import {
  IconList,
  IconClose,
  IconTrash,
  IconSun,
  IconMoon,
  IconBug,
  IconLightbulb,
  IconQuestion,
  IconAccessibility,
  IconExport,
} from '../Icons';
import {
  identifyElement,
  hasFixedPositioning,
} from '@/utils/element-identification';
import {
  loadAnnotations,
  saveAnnotation,
  deleteAnnotation,
  clearAnnotations,
  getStorageKey,
  updateBadgeCount,
} from '@/utils/storage';
import { throttle, debounce } from '@/utils/timing';
import type { Annotation, FeedbackCategory } from '@/types';
import { getCategoryConfig } from '@/shared/categories';
import { classNames } from '@/utils/classNames';

// Lazy load ExportModal for bundle size optimization
const ExportModal = lazy(() =>
  import('../ExportModal').then((m) => ({ default: m.ExportModal }))
);

// Performance constants
const HOVER_THROTTLE_MS = 50;
const BADGE_DEBOUNCE_MS = 150;

const getMotionVariants = (reduceMotion: boolean) => ({
  toolbar: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { y: 6, scale: 0.96 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { y: 0, scale: 1 }),
      transition: reduceMotion
        ? { duration: 0.15, ease: 'easeOut' }
        : { type: 'spring', stiffness: 400, damping: 25 },
    },
  },
  badge: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.9 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: reduceMotion
        ? { duration: 0.12, ease: 'easeOut' }
        : { type: 'spring', stiffness: 500, damping: 20, delay: 0.4 },
    },
  },
  marker: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.9 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: reduceMotion
        ? { duration: 0.12, ease: 'easeOut' }
        : { type: 'spring', stiffness: 400, damping: 20 },
    },
    hover: {
      ...(reduceMotion ? {} : { scale: 1.08 }),
      transition: { duration: 0.1, ease: 'easeOut' },
    },
  },
  categoryPanel: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: -8 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1, y: 0 }),
      transition: { duration: 0.15, ease: 'easeOut' },
    },
    exit: {
      opacity: 0,
      ...(reduceMotion ? {} : { scale: 0.95, y: -8 }),
      transition: { duration: 0.1, ease: 'easeIn' },
    },
  },
  markerTooltip: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: 2 }) },
    visible: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: 2 }) },
    hover: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1, y: 0 }),
      transition: { duration: 0.1, ease: 'easeOut' },
    },
  },
  hoverHighlight: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.98 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: { duration: 0.12, ease: 'easeOut' },
    },
  },
  hoverTooltip: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.95, y: 4 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1, y: 0 }),
      transition: { duration: 0.1, ease: 'easeOut' },
    },
  },
  iconSwap: {
    hidden: { opacity: 0, ...(reduceMotion ? {} : { scale: 0.8 }) },
    visible: {
      opacity: 1,
      ...(reduceMotion ? {} : { scale: 1 }),
      transition: { duration: 0.12, ease: 'easeOut' },
    },
    exit: {
      opacity: 0,
      ...(reduceMotion ? {} : { scale: 0.8 }),
      transition: { duration: 0.08, ease: 'easeIn' },
    },
  },
});

// =============================================================================
// Types
// =============================================================================

interface FeedbackToolbarProps {
  shadowRoot: ShadowRoot;
  lightMode?: boolean;
  onLightModeChange?: (lightMode: boolean) => void;
}

type HoverInfo = {
  element: string;
};

type PendingAnnotation = {
  x: number;
  y: number;
  element: string;
  elementPath: string;
  target: HTMLElement;
  rect: DOMRect;
  isFixed: boolean;
  scrollX: number;
  scrollY: number;
};

type AddMode = 'idle' | 'category' | 'selecting';

type ToolbarState = {
  isExpanded: boolean;
  addMode: AddMode;
  selectedCategory: FeedbackCategory;
  hoverInfo: HoverInfo | null;
  pendingAnnotation: PendingAnnotation | null;
  selectedAnnotationId: string | null;
  isExportModalOpen: boolean;
  isEntranceComplete: boolean;
  isHidden: boolean;
};

type ToolbarAction =
  | { type: 'setExpanded'; value: boolean }
  | { type: 'setAddMode'; value: AddMode }
  | { type: 'setSelectedCategory'; value: FeedbackCategory }
  | { type: 'setHoverInfo'; value: HoverInfo | null }
  | { type: 'setPendingAnnotation'; value: PendingAnnotation | null }
  | { type: 'setSelectedAnnotationId'; value: string | null }
  | { type: 'setExportModalOpen'; value: boolean }
  | { type: 'setEntranceComplete'; value: boolean }
  | { type: 'setHidden'; value: boolean };

const initialToolbarState: ToolbarState = {
  isExpanded: true,
  addMode: 'idle',
  selectedCategory: 'suggestion',
  hoverInfo: null,
  pendingAnnotation: null,
  selectedAnnotationId: null,
  isExportModalOpen: false,
  isEntranceComplete: false,
  isHidden: false,
};

function toolbarReducer(state: ToolbarState, action: ToolbarAction): ToolbarState {
  switch (action.type) {
    case 'setExpanded':
      return { ...state, isExpanded: action.value };
    case 'setAddMode': {
      const addMode = action.value;
      return {
        ...state,
        addMode,
        hoverInfo: addMode === 'selecting' ? state.hoverInfo : null,
        pendingAnnotation:
          addMode === 'selecting' || addMode === 'category' ? null : state.pendingAnnotation,
      };
    }
    case 'setSelectedCategory':
      return { ...state, selectedCategory: action.value };
    case 'setHoverInfo':
      return { ...state, hoverInfo: action.value };
    case 'setPendingAnnotation':
      return action.value
        ? { ...state, pendingAnnotation: action.value, addMode: 'idle', hoverInfo: null }
        : { ...state, pendingAnnotation: null };
    case 'setSelectedAnnotationId':
      return { ...state, selectedAnnotationId: action.value };
    case 'setExportModalOpen':
      return { ...state, isExportModalOpen: action.value };
    case 'setEntranceComplete':
      return { ...state, isEntranceComplete: action.value };
    case 'setHidden':
      return { ...state, isHidden: action.value };
    default:
      return state;
  }
}

// =============================================================================
// Component
// =============================================================================

export function FeedbackToolbar({
  shadowRoot,
  lightMode = false,
  onLightModeChange,
}: FeedbackToolbarProps) {
  // State
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [savedToolbarPosition, setSavedToolbarPosition] = useState<Position | null>(null);
  const [toolbarState, dispatch] = useReducer(toolbarReducer, initialToolbarState);
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const motionVariants = useMemo(
    () => getMotionVariants(reduceMotion),
    [reduceMotion]
  );
  const tooltipDelayTimerRef = useRef<number | null>(null);
  const hoverHighlightX = useMotionValue(0);
  const hoverHighlightY = useMotionValue(0);
  const hoverHighlightWidth = useMotionValue(0);
  const hoverHighlightHeight = useMotionValue(0);
  const hoverTooltipX = useMotionValue(0);
  const hoverTooltipY = useMotionValue(0);
  const hoverElementPathRef = useRef<string | null>(null);
  const hoverElementLabelRef = useRef<string | null>(null);
  const hoverInfoRef = useRef<HoverInfo | null>(null);

  const {
    isExpanded,
    addMode,
    selectedCategory,
    hoverInfo,
    pendingAnnotation,
    selectedAnnotationId,
    isExportModalOpen,
    isEntranceComplete,
    isHidden,
  } = toolbarState;

  const isSelectingElement = addMode === 'selecting';
  const isCategoryPanelOpen = addMode === 'category';
  const expandedControlsTransition = reduceMotion
    ? 'transition-[opacity,transform,visibility]'
    : 'transition-[filter,opacity,transform,visibility]';

  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId]
  );

  const hasSelectedAnnotation = Boolean(selectedAnnotation);

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
        tooltipDelayTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (selectedAnnotationId && !selectedAnnotation) {
      dispatch({ type: 'setSelectedAnnotationId', value: null });
    }
  }, [selectedAnnotationId, selectedAnnotation]);

  useEffect(() => {
    hoverInfoRef.current = hoverInfo;
  }, [hoverInfo]);

  const { absoluteMarkers, fixedMarkers } = useMemo(() => {
    const absolute: Annotation[] = [];
    const fixed: Annotation[] = [];

    annotations.forEach((annotation) => {
      if (annotation.isFixed) {
        fixed.push(annotation);
      } else {
        absolute.push(annotation);
      }
    });

    return { absoluteMarkers: absolute, fixedMarkers: fixed };
  }, [annotations]);

  // Handle position persistence
  const handleToolbarPositionChange = useCallback((position: Position) => {
    saveToolbarPosition(position).catch((error) => {
      console.error('Failed to save toolbar position:', error);
    });
  }, []);

  // Draggable toolbar
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

  // Debounced badge update
  const debouncedUpdateBadgeCount = useMemo(
    () => debounce((count: number) => updateBadgeCount(count), BADGE_DEBOUNCE_MS),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateBadgeCount.cancel();
    };
  }, [debouncedUpdateBadgeCount]);

  // Sync badge count with annotations length
  useEffect(() => {
    debouncedUpdateBadgeCount(annotations.length);
  }, [annotations.length, debouncedUpdateBadgeCount]);

  // Load toolbar position and annotations in parallel on mount
  useEffect(() => {
    let isCancelled = false;

    const loadInitialData = async () => {
      try {
        const [position, loaded] = await Promise.all([
          loadToolbarPosition(),
          loadAnnotations(),
        ]);
        if (!isCancelled) {
          setSavedToolbarPosition(position);
          setAnnotations(loaded);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };
    loadInitialData();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Entrance animation complete
  useEffect(() => {
    const timer = setTimeout(
      () => dispatch({ type: 'setEntranceComplete', value: true }),
      500
    );
    return () => clearTimeout(timer);
  }, []);

  // Listen for external events (runtime messages and UI events)
  useEffect(() => {
    // Handle export trigger from popup
    const handleExportMessage = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type === 'TRIGGER_EXPORT') {
        dispatch({ type: 'setExportModalOpen', value: true });
      }
    };
    browser.runtime.onMessage.addListener(handleExportMessage);

    // Handle hide/show events from export functions
    const offHide = onUiEvent('hide-ui', () => dispatch({ type: 'setHidden', value: true }));
    const offShow = onUiEvent('show-ui', () => dispatch({ type: 'setHidden', value: false }));
    const offOpen = onUiEvent('open-export', () =>
      dispatch({ type: 'setExportModalOpen', value: true })
    );

    return () => {
      browser.runtime.onMessage.removeListener(handleExportMessage);
      offHide();
      offShow();
      offOpen();
    };
  }, []);

  // Set up hover and click listeners for add mode
  useEffect(() => {
    if (!isSelectingElement) return undefined;

    const handleAddModeClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest('[data-annotation-popup]') || target.closest('[data-toolbar]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const rect = target.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const scrollLeft = window.scrollX;
      const isFixed = hasFixedPositioning(target);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const { name, path } = identifyElement(target);

      dispatch({
        type: 'setPendingAnnotation',
        value: {
          x: isFixed ? centerX : centerX + scrollLeft,
          y: isFixed ? centerY : centerY + scrollTop,
          element: name,
          elementPath: path,
          target,
          rect,
          isFixed,
          scrollX: scrollLeft,
          scrollY: scrollTop,
        },
      });
    };

    const handleAddModeHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest('[data-annotation-popup]') || target.closest('[data-toolbar]')) {
        if (hoverInfoRef.current) {
          hoverElementPathRef.current = null;
          hoverElementLabelRef.current = null;
          dispatch({ type: 'setHoverInfo', value: null });
        }
        return;
      }

      const rect = target.getBoundingClientRect();
      const { name, path } = identifyElement(target);

      hoverHighlightX.set(rect.left);
      hoverHighlightY.set(rect.top);
      hoverHighlightWidth.set(rect.width);
      hoverHighlightHeight.set(rect.height);
      hoverTooltipX.set(rect.left);
      hoverTooltipY.set(rect.bottom + 8);

      if (hoverElementPathRef.current !== path || hoverElementLabelRef.current !== name) {
        hoverElementPathRef.current = path;
        hoverElementLabelRef.current = name;
        dispatch({
          type: 'setHoverInfo',
          value: {
            element: name,
          },
        });
      } else if (!hoverInfoRef.current) {
        dispatch({
          type: 'setHoverInfo',
          value: {
            element: name,
          },
        });
      }
    };

    const handleAddModeHoverThrottled = throttle(handleAddModeHover, HOVER_THROTTLE_MS);

    document.addEventListener('mouseover', handleAddModeHoverThrottled);
    document.addEventListener('click', handleAddModeClick, true);

    return () => {
      document.removeEventListener('mouseover', handleAddModeHoverThrottled);
      document.removeEventListener('click', handleAddModeClick, true);
      handleAddModeHoverThrottled.cancel();
    };
    // Motion values are stable refs (from useMotionValue) that never change identity.
    // They're only mutated via .set() inside the callback, so adding them to deps
    // would cause unnecessary re-subscriptions without any benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectingElement]);

  // Toggle body class for crosshair cursor in add mode
  useEffect(() => {
    if (isSelectingElement) {
      document.body.classList.add('designer-feedback-add-mode');
    } else {
      document.body.classList.remove('designer-feedback-add-mode');
    }

    return () => {
      document.body.classList.remove('designer-feedback-add-mode');
    };
  }, [isSelectingElement]);

  // Ref to store escape handler state - avoids re-subscribing on state changes
  const escapeStateRef = useRef({
    hasSelectedAnnotation,
    isSelectingElement,
    pendingAnnotation,
    isCategoryPanelOpen,
  });

  // Keep ref in sync with current state
  useEffect(() => {
    escapeStateRef.current = {
      hasSelectedAnnotation,
      isSelectingElement,
      pendingAnnotation,
      isCategoryPanelOpen,
    };
  });

  // Cancel add mode on escape - stable subscription with ref pattern
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        const state = escapeStateRef.current;
        if (state.isCategoryPanelOpen) {
          dispatch({ type: 'setAddMode', value: 'idle' });
        } else if (state.hasSelectedAnnotation) {
          dispatch({ type: 'setSelectedAnnotationId', value: null });
        } else if (state.pendingAnnotation) {
          dispatch({ type: 'setPendingAnnotation', value: null });
        } else if (state.isSelectingElement) {
          dispatch({ type: 'setAddMode', value: 'idle' });
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []); // Empty deps - stable subscription

  // Close active annotation when clicking outside
  useEffect(() => {
    if (!selectedAnnotation) return;

    const handlePointerDown = (event: MouseEvent) => {
      const path = event.composedPath ? event.composedPath() : [];
      const isInside = path.some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        if (node.hasAttribute('data-annotation-popup')) return true;
        if (node.hasAttribute('data-annotation-marker')) return true;
        if (node.hasAttribute('data-toolbar')) return true;
        return Boolean(
          node.closest?.('[data-annotation-popup], [data-annotation-marker], [data-toolbar]')
        );
      });

      if (!isInside) {
        dispatch({ type: 'setSelectedAnnotationId', value: null });
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [selectedAnnotation]);

  // Handle annotation submit
  const handleAnnotationSubmit = useCallback(
    async (comment: string) => {
      if (!pendingAnnotation) return;

      const scrollX = pendingAnnotation.scrollX;
      const scrollY = pendingAnnotation.scrollY;
      const rect = pendingAnnotation.rect;
      const boundingBox = {
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
      };

      const newAnnotation: Annotation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        x: pendingAnnotation.x,
        y: pendingAnnotation.y,
        comment,
        category: selectedCategory,
        element: pendingAnnotation.element,
        elementPath: pendingAnnotation.elementPath,
        timestamp: Date.now(),
        isFixed: pendingAnnotation.isFixed,
        boundingBox,
      };

      try {
        await saveAnnotation({ ...newAnnotation, url: getStorageKey() });
        setAnnotations((current) => [...current, newAnnotation]);
      } catch (error) {
        console.error('Failed to save annotation:', error);
      }

      dispatch({ type: 'setPendingAnnotation', value: null });
    },
    [pendingAnnotation, selectedCategory]
  );

  // Handle annotation delete
  const handleDeleteAnnotation = useCallback(
    async (id: string) => {
      try {
        await deleteAnnotation(id);
        setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
        if (selectedAnnotationId === id) {
          dispatch({ type: 'setSelectedAnnotationId', value: null });
        }
      } catch (error) {
        console.error('Failed to delete annotation:', error);
      }
    },
    [selectedAnnotationId]
  );

  // Handle clear all - use startTransition for non-urgent UI updates
  const handleClearAllAnnotations = useCallback(async () => {
    try {
      await clearAnnotations();
      startTransition(() => {
        setAnnotations([]);
        dispatch({ type: 'setSelectedAnnotationId', value: null });
      });
    } catch (error) {
      console.error('Failed to clear annotations:', error);
    }
  }, []);

  // Toggle category panel
  const handleToggleCategoryPanel = useCallback(() => {
    if (isSelectingElement) {
      dispatch({ type: 'setAddMode', value: 'idle' });
    } else {
      dispatch({
        type: 'setAddMode',
        value: isCategoryPanelOpen ? 'idle' : 'category',
      });
    }
    dispatch({ type: 'setPendingAnnotation', value: null });
  }, [isSelectingElement, isCategoryPanelOpen]);

  // Handle category selection
  const handleCategorySelect = useCallback((category: FeedbackCategory) => {
    dispatch({ type: 'setSelectedCategory', value: category });
    dispatch({ type: 'setAddMode', value: 'selecting' });
  }, []);

  // Render marker tooltip content
  const renderAnnotationTooltip = (annotation: Annotation) => {
    const config = getCategoryConfig(annotation.category);
    return (
      <m.div
        variants={motionVariants.markerTooltip}
        className={classNames(
          'absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-tooltip',
          'px-3 py-2 rounded-xl min-w-[120px] max-w-[200px] pointer-events-none cursor-default',
          'bg-white shadow-popup-light',
          'dark:bg-[#1a1a1a] dark:shadow-popup'
        )}
      >
        <span
          className="block text-xs font-semibold mb-1"
          style={{ color: config.color }}
        >
          {config.emoji} {config.label}
        </span>
        <span
          className={classNames(
            'block text-[13px] font-normal leading-tight whitespace-nowrap overflow-hidden text-ellipsis pb-0.5',
            'text-black/85 dark:text-white'
          )}
        >
          {annotation.comment}
        </span>
        <span
          className={classNames(
            'block text-2xs font-normal mt-1.5 whitespace-nowrap',
            'text-black/35 dark:text-white/60'
          )}
        >
          Click to view
        </span>
      </m.div>
    );
  };

  // Render annotation markers
  const renderAnnotationMarkers = () => {
    return (
      <>
        {/* Absolute positioned markers */}
        <div className="absolute top-0 left-0 right-0 h-0 z-markers pointer-events-none [&>*]:pointer-events-auto">
          {absoluteMarkers.map((annotation, index) => {
            const config = getCategoryConfig(annotation.category);

            return (
              <m.div
                key={annotation.id}
                initial={!isEntranceComplete ? 'hidden' : false}
                animate="visible"
                whileHover="hover"
                variants={motionVariants.marker}
                className={classNames(
                  'absolute w-[22px] h-[22px] rounded-full flex items-center justify-center',
                  'text-xs font-semibold text-white cursor-pointer select-none',
                  'shadow-marker -translate-x-1/2 -translate-y-1/2 z-[1]',
                  'hover:z-[2]'
                )}
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                data-annotation-marker
                onClick={() =>
                  dispatch({ type: 'setSelectedAnnotationId', value: annotation.id })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'setSelectedAnnotationId', value: annotation.id });
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Annotation ${index + 1} (${config.label})`}
              >
                {index + 1}
                {renderAnnotationTooltip(annotation)}
              </m.div>
            );
          })}
        </div>

        {/* Fixed positioned markers */}
        <div className="fixed inset-0 z-markers pointer-events-none [&>*]:pointer-events-auto">
          {fixedMarkers.map((annotation, index) => {
            const config = getCategoryConfig(annotation.category);
            const globalIndex = absoluteMarkers.length + index + 1;

            return (
              <m.div
                key={annotation.id}
                initial={!isEntranceComplete ? 'hidden' : false}
                animate="visible"
                whileHover="hover"
                variants={motionVariants.marker}
                className={classNames(
                  'fixed w-[22px] h-[22px] rounded-full flex items-center justify-center',
                  'text-xs font-semibold text-white cursor-pointer select-none',
                  'shadow-marker -translate-x-1/2 -translate-y-1/2 z-[1]',
                  'hover:z-[2]'
                )}
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                data-annotation-marker
                onClick={() =>
                  dispatch({ type: 'setSelectedAnnotationId', value: annotation.id })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    dispatch({ type: 'setSelectedAnnotationId', value: annotation.id });
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Annotation ${globalIndex} (${config.label})`}
              >
                {globalIndex}
                {renderAnnotationTooltip(annotation)}
              </m.div>
            );
          })}
        </div>

        {/* Pending marker */}
        <AnimatePresence>
          {pendingAnnotation && (
            <m.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={motionVariants.marker}
              className={classNames(
                'w-[22px] h-[22px] rounded-full flex items-center justify-center',
                'text-xs font-semibold text-white select-none',
                'shadow-marker -translate-x-1/2 -translate-y-1/2 bg-df-blue'
              )}
              style={{
                left: `${pendingAnnotation.x}px`,
                top: pendingAnnotation.isFixed
                  ? `${pendingAnnotation.rect.top + pendingAnnotation.rect.height / 2}px`
                  : `${pendingAnnotation.y}px`,
                position: pendingAnnotation.isFixed ? 'fixed' : 'absolute',
              }}
            >
              {annotations.length + 1}
            </m.div>
          )}
        </AnimatePresence>
      </>
    );
  };

  // Hide all UI during screenshot capture
  if (isHidden) {
    return null;
  }

  // Dark mode wrapper: add 'dark' class when NOT in light mode
  const darkModeClassName = !lightMode ? 'dark' : '';

  return createPortal(
    <div
      className={classNames('font-sans df-root', darkModeClassName)}
      data-tooltips-ready={tooltipsReady ? 'true' : 'false'}
      onMouseEnter={handleTooltipWarmup}
    >
      {/* Hover highlight overlay */}
      <AnimatePresence>
        {isSelectingElement && hoverInfo ? (
          <div className="fixed inset-0 z-overlay pointer-events-none [&>*]:pointer-events-auto">
            <m.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={motionVariants.hoverHighlight}
              className="fixed border-2 border-df-blue/50 rounded bg-df-blue/4 pointer-events-none box-border"
              style={{
                left: hoverHighlightX,
                top: hoverHighlightY,
                width: hoverHighlightWidth,
                height: hoverHighlightHeight,
              }}
            />
            <m.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={motionVariants.hoverTooltip}
              className="fixed text-xs font-medium text-white bg-black/85 py-1.5 px-2.5 rounded-md pointer-events-none whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
              style={{
                left: hoverTooltipX,
                top: hoverTooltipY,
              }}
            >
              {hoverInfo.element}
            </m.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Annotation markers */}
      {renderAnnotationMarkers()}

      {/* Annotation popup - create mode */}
      {pendingAnnotation ? (
        <AnnotationPopup
          mode="create"
          element={pendingAnnotation.element}
          onSubmit={handleAnnotationSubmit}
          onCancel={() => dispatch({ type: 'setPendingAnnotation', value: null })}
          lightMode={lightMode}
          style={{
            left: `${pendingAnnotation.x}px`,
            top: pendingAnnotation.isFixed
              ? pendingAnnotation.rect.bottom + 16
              : pendingAnnotation.y + pendingAnnotation.rect.height / 2 + 16,
            position: pendingAnnotation.isFixed ? 'fixed' : 'absolute',
          }}
        />
      ) : null}

      {/* Annotation popup - view mode */}
      {selectedAnnotation ? (
        <AnnotationPopup
          mode="view"
          element={selectedAnnotation.element}
          annotation={selectedAnnotation}
          onDelete={() => {
            handleDeleteAnnotation(selectedAnnotation.id);
            dispatch({ type: 'setSelectedAnnotationId', value: null });
          }}
          onCancel={() => dispatch({ type: 'setSelectedAnnotationId', value: null })}
          lightMode={lightMode}
          style={{
            left: `${selectedAnnotation.x}px`,
            top: selectedAnnotation.isFixed
              ? selectedAnnotation.y + 24
              : selectedAnnotation.y + 24,
            position: selectedAnnotation.isFixed ? 'fixed' : 'absolute',
          }}
        />
      ) : null}

      {/* Export Modal (lazy-loaded) */}
      <AnimatePresence>
        {isExportModalOpen && (
          <Suspense fallback={null}>
            <ExportModal
              annotations={annotations}
              onClose={() => dispatch({ type: 'setExportModalOpen', value: false })}
              lightMode={lightMode}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div
        className={classNames(
          'fixed top-5 right-5 z-toolbar font-sans pointer-events-none',
          isDragging && 'cursor-grabbing [&_*]:cursor-grabbing'
        )}
        data-toolbar
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
          variants={motionVariants.toolbar}
          className={classNames(
            'select-none flex items-center justify-center pointer-events-auto cursor-default',
            'transition-[width] duration-[240ms] ease-[cubic-bezier(0.19,1,0.22,1)]',
            // Light mode (default)
            'bg-white text-black/85 shadow-toolbar-light',
            // Dark mode
            'dark:bg-df-dark dark:text-white dark:border dark:border-white/8 dark:shadow-toolbar',
            // Collapsed/expanded state
            isExpanded
              ? 'w-auto h-11 rounded-[1.5rem] p-1.5'
              : classNames(
                  'w-11 h-11 rounded-[22px] p-0 cursor-pointer',
                  'hover:bg-[#f5f5f5] dark:hover:bg-df-dark-hover',
                  'active:scale-[0.97]'
                )
          )}
          onClick={() =>
            !isExpanded && dispatch({ type: 'setExpanded', value: true })
          }
          onKeyDown={(event) => {
            if (!isExpanded && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              dispatch({ type: 'setExpanded', value: true });
            }
          }}
          onMouseDown={(e) => {
            handleToolbarDragMouseDown(e);
          }}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
        >
          {/* Collapsed state: show icon + badge */}
          <div
            className={classNames(
              'absolute flex items-center justify-center transition-[opacity,visibility] duration-100',
              isExpanded
                ? 'opacity-0 invisible pointer-events-none'
                : 'opacity-100 visible pointer-events-auto'
            )}
          >
            <IconList size={20} />
            <AnimatePresence>
              {annotations.length > 0 && (
                <m.span
                  initial={!isEntranceComplete ? 'hidden' : false}
                  animate="visible"
                  exit="hidden"
                  variants={motionVariants.badge}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-[9px] bg-df-blue text-white text-2xs font-semibold flex items-center justify-center shadow-sm"
                >
                  {annotations.length}
                </m.span>
              )}
            </AnimatePresence>
          </div>

          {/* Expanded state: show controls */}
          <div
            className={classNames(
              `flex items-center gap-1.5 ${expandedControlsTransition} duration-[220ms]`,
              isExpanded
                ? classNames(
                    'opacity-100 scale-100 visible pointer-events-auto',
                    !reduceMotion && 'blur-0'
                  )
                : classNames(
                    'opacity-0 scale-60 invisible pointer-events-none',
                    !reduceMotion && 'blur-[6px]'
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
                onClick={handleToggleCategoryPanel}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSelectingElement ? (
                    <m.span
                      key="close"
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={motionVariants.iconSwap}
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
                      variants={motionVariants.iconSwap}
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

              {/* Category selection panel */}
              <AnimatePresence>
                {isCategoryPanelOpen && (
                  <m.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={motionVariants.categoryPanel}
                    className="category-panel"
                  >
                    <button
                      className="category-panel-item focus-ring"
                      type="button"
                      onClick={() => handleCategorySelect('bug')}
                      style={{ '--category-color': '#FF3B30' } as CSSProperties}
                    >
                      <IconBug size={20} />
                      <span>Bug</span>
                    </button>
                    <button
                      className="category-panel-item focus-ring"
                      type="button"
                      onClick={() => handleCategorySelect('question')}
                      style={{ '--category-color': '#FFD60A' } as CSSProperties}
                    >
                      <IconQuestion size={20} />
                      <span>Question</span>
                    </button>
                    <button
                      className="category-panel-item focus-ring"
                      type="button"
                      onClick={() => handleCategorySelect('suggestion')}
                      style={{ '--category-color': '#3C82F7' } as CSSProperties}
                    >
                      <IconLightbulb size={20} />
                      <span>Suggestion</span>
                    </button>
                    <button
                      className="category-panel-item focus-ring"
                      type="button"
                      onClick={() => handleCategorySelect('accessibility')}
                      style={{ '--category-color': '#AF52DE' } as CSSProperties}
                    >
                      <IconAccessibility size={20} />
                      <span>Accessibility</span>
                    </button>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            <div className="toolbar-divider" />

            {/* Export button */}
            <div className="relative flex items-center justify-center group">
              <button
                className="btn-toolbar"
                type="button"
                aria-label="Export feedback"
                aria-describedby="tooltip-export"
                onClick={() =>
                  startTransition(() => dispatch({ type: 'setExportModalOpen', value: true }))
                }
                onMouseEnter={() => void import('../ExportModal')}
                onFocus={() => void import('../ExportModal')}
                disabled={annotations.length === 0}
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
                onClick={handleClearAllAnnotations}
                disabled={annotations.length === 0}
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
                onClick={() => onLightModeChange?.(!lightMode)}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {lightMode ? (
                    <m.span
                      key="moon"
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={motionVariants.iconSwap}
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
                      variants={motionVariants.iconSwap}
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
                onClick={() => dispatch({ type: 'setExpanded', value: false })}
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
    </div>,
    shadowRoot
  );
}
