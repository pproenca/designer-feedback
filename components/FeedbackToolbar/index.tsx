/**
 * FeedbackToolbar - Composition root for the annotation toolbar
 *
 * This is the main entry point that composes:
 * - Toolbar UI component
 * - CategoryPanel for annotation type selection
 * - SelectionOverlay for element highlighting
 * - AnnotationLayer for markers
 * - AnnotationPopup for creating/viewing annotations
 * - ExportModal for exporting feedback
 *
 * Refactored from a 1265-line monolithic component to ~300 lines.
 */

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
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';

import { AnnotationPopup } from '../AnnotationPopup';
import { Toolbar } from './Toolbar';
import { CategoryPanel } from './CategoryPanel';
import { SelectionOverlay } from '../SelectionOverlay';
import { AnnotationLayer } from '../AnnotationLayer';
import { onUiEvent } from '@/utils/ui-events';
import { loadToolbarPosition, saveToolbarPosition } from './toolbar-position';
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
import {
  calculatePopupPosition,
  getPopupDisplayPosition,
} from '@/utils/annotation-position';
import { debounce } from '@/utils/timing';
import { classNames } from '@/utils/classNames';
import type { Annotation, FeedbackCategory } from '@/types';
import type { Position } from '@/hooks/useDraggable';
import { toolbarReducer, initialToolbarState } from './context';

// Lazy load ExportModal for bundle size optimization
const ExportModal = lazy(() =>
  import('../ExportModal').then((m) => ({ default: m.ExportModal }))
);

// Performance constants
const BADGE_DEBOUNCE_MS = 150;

// =============================================================================
// Types
// =============================================================================

interface FeedbackToolbarProps {
  shadowRoot: ShadowRoot;
  lightMode?: boolean;
  onLightModeChange?: (lightMode: boolean) => void;
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
  const tooltipDelayTimerRef = useRef<number | null>(null);

  const {
    isExpanded,
    addMode,
    selectedCategory,
    pendingAnnotation,
    selectedAnnotationId,
    isExportModalOpen,
    isEntranceComplete,
    isHidden,
  } = toolbarState;

  const isSelectingElement = addMode === 'selecting';
  const isCategoryPanelOpen = addMode === 'category';

  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId]
  );

  const hasSelectedAnnotation = Boolean(selectedAnnotation);

  // Tooltip warmup
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

  // Clear stale selected annotation
  useEffect(() => {
    if (selectedAnnotationId && !selectedAnnotation) {
      dispatch({ type: 'setSelectedAnnotationId', value: null });
    }
  }, [selectedAnnotationId, selectedAnnotation]);

  // Handle position persistence
  const handleToolbarPositionChange = useCallback((position: Position) => {
    saveToolbarPosition(position).catch(console.error);
  }, []);

  // Debounced badge update
  const debouncedUpdateBadgeCount = useMemo(
    () => debounce((count: number) => updateBadgeCount(count), BADGE_DEBOUNCE_MS),
    []
  );

  useEffect(() => {
    return () => debouncedUpdateBadgeCount.cancel();
  }, [debouncedUpdateBadgeCount]);

  useEffect(() => {
    debouncedUpdateBadgeCount(annotations.length);
  }, [annotations.length, debouncedUpdateBadgeCount]);

  // Load initial data
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

  // Listen for external events
  useEffect(() => {
    const handleExportMessage = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type === 'TRIGGER_EXPORT') {
        dispatch({ type: 'setExportModalOpen', value: true });
      }
    };
    browser.runtime.onMessage.addListener(handleExportMessage);

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

  // Element selection click handler
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

    document.addEventListener('click', handleAddModeClick, true);
    return () => document.removeEventListener('click', handleAddModeClick, true);
  }, [isSelectingElement]);

  // Body class for crosshair cursor
  useEffect(() => {
    if (isSelectingElement) {
      document.body.classList.add('designer-feedback-add-mode');
    } else {
      document.body.classList.remove('designer-feedback-add-mode');
    }
    return () => document.body.classList.remove('designer-feedback-add-mode');
  }, [isSelectingElement]);

  // Escape key handler
  const escapeStateRef = useRef({
    hasSelectedAnnotation,
    isSelectingElement,
    pendingAnnotation,
    isCategoryPanelOpen,
  });

  useEffect(() => {
    escapeStateRef.current = {
      hasSelectedAnnotation,
      isSelectingElement,
      pendingAnnotation,
      isCategoryPanelOpen,
    };
  });

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
  }, []);

  // Click outside handler for selected annotation
  useEffect(() => {
    if (!selectedAnnotation) return;

    const handlePointerDown = (event: MouseEvent) => {
      const path = event.composedPath ? event.composedPath() : [];
      const isInside = path.some((node) => {
        if (!(node instanceof HTMLElement)) return false;
        return Boolean(
          node.hasAttribute('data-annotation-popup') ||
          node.hasAttribute('data-annotation-marker') ||
          node.hasAttribute('data-toolbar') ||
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

  // Handlers
  const handleAnnotationSubmit = useCallback(
    async (comment: string) => {
      if (!pendingAnnotation) return;

      const { scrollX, scrollY, rect } = pendingAnnotation;
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

  const handleDeleteAnnotation = useCallback(
    async (id: string) => {
      try {
        await deleteAnnotation(id);
        setAnnotations((current) => current.filter((a) => a.id !== id));
        if (selectedAnnotationId === id) {
          dispatch({ type: 'setSelectedAnnotationId', value: null });
        }
      } catch (error) {
        console.error('Failed to delete annotation:', error);
      }
    },
    [selectedAnnotationId]
  );

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

  const handleCategorySelect = useCallback((category: FeedbackCategory) => {
    dispatch({ type: 'setSelectedCategory', value: category });
    dispatch({ type: 'setAddMode', value: 'selecting' });
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    dispatch({ type: 'setSelectedAnnotationId', value: id });
  }, []);

  // Hide all UI during screenshot
  if (isHidden) {
    return null;
  }

  const darkModeClassName = !lightMode ? 'dark' : '';

  return createPortal(
    <div className={classNames('font-sans df-root', darkModeClassName)}>
      {/* Selection overlay for element highlighting */}
      <SelectionOverlay enabled={isSelectingElement} />

      {/* Annotation markers */}
      <AnnotationLayer
        annotations={annotations}
        pendingAnnotation={pendingAnnotation}
        isEntranceComplete={isEntranceComplete}
        onMarkerClick={handleMarkerClick}
      />

      {/* Annotation popup - create mode */}
      {pendingAnnotation ? (() => {
        const popupPos = calculatePopupPosition({
          rect: pendingAnnotation.rect,
          scrollX: pendingAnnotation.scrollX,
          scrollY: pendingAnnotation.scrollY,
          isFixed: pendingAnnotation.isFixed,
        });
        return (
          <AnnotationPopup
            mode="create"
            element={pendingAnnotation.element}
            onSubmit={handleAnnotationSubmit}
            onCancel={() => dispatch({ type: 'setPendingAnnotation', value: null })}
            lightMode={lightMode}
            x={popupPos.x}
            y={popupPos.y}
            isFixed={popupPos.isFixed}
          />
        );
      })() : null}

      {/* Annotation popup - view mode */}
      {selectedAnnotation ? (() => {
        const popupPos = getPopupDisplayPosition(selectedAnnotation);
        return (
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
            x={popupPos.x}
            y={popupPos.y}
            isFixed={popupPos.isFixed}
          />
        );
      })() : null}

      {/* Export Modal */}
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
      <Toolbar
        isExpanded={isExpanded}
        isEntranceComplete={isEntranceComplete}
        annotationsCount={annotations.length}
        onExpandedChange={(expanded) => dispatch({ type: 'setExpanded', value: expanded })}
        onAddClick={handleToggleCategoryPanel}
        onExportClick={() =>
          startTransition(() => dispatch({ type: 'setExportModalOpen', value: true }))
        }
        onClearClick={handleClearAllAnnotations}
        onThemeToggle={() => onLightModeChange?.(!lightMode)}
        isSelectingElement={isSelectingElement}
        isCategoryPanelOpen={isCategoryPanelOpen}
        lightMode={lightMode}
        tooltipsReady={tooltipsReady}
        onTooltipWarmup={handleTooltipWarmup}
        initialPosition={savedToolbarPosition}
        onPositionChange={handleToolbarPositionChange}
      >
        <CategoryPanel
          isOpen={isCategoryPanelOpen}
          onCategorySelect={handleCategorySelect}
        />
      </Toolbar>
    </div>,
    shadowRoot
  );
}
