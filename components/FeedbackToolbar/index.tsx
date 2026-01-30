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
 * State management migrated from useReducer to Zustand stores.
 */

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
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
  calculatePopupPosition,
  getPopupDisplayPosition,
} from '@/utils/annotation-position';
import { clsx } from 'clsx';
import type { Annotation, FeedbackCategory } from '@/types';
import type { Position } from '@/hooks/useDraggable';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useClickOutside } from '@/hooks/useClickOutside';
import type { PendingAnnotation } from './context';

// Zustand stores
import { useToolbarStore } from '@/stores/toolbar';
import { useAnnotationsStore } from '@/stores/annotations';

// Lazy load ExportModal for bundle size optimization
const ExportModal = lazy(() =>
  import('../ExportModal').then((m) => ({ default: m.ExportModal }))
);

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
  // Zustand store state
  const isExpanded = useToolbarStore((s) => s.isExpanded);
  const addMode = useToolbarStore((s) => s.addMode);
  const selectedCategory = useToolbarStore((s) => s.selectedCategory);
  const pendingAnnotation = useToolbarStore((s) => s.pendingAnnotation);
  const selectedAnnotationId = useToolbarStore((s) => s.selectedAnnotationId);
  const isExportModalOpen = useToolbarStore((s) => s.isExportModalOpen);
  const isEntranceComplete = useToolbarStore((s) => s.isEntranceComplete);
  const isHidden = useToolbarStore((s) => s.isHidden);

  // Toolbar actions
  const toolbarExpanded = useToolbarStore((s) => s.toolbarExpanded);
  const toolbarCollapsed = useToolbarStore((s) => s.toolbarCollapsed);
  const categorySelected = useToolbarStore((s) => s.categorySelected);
  const elementSelected = useToolbarStore((s) => s.elementSelected);
  const pendingAnnotationCleared = useToolbarStore((s) => s.pendingAnnotationCleared);
  const annotationSelected = useToolbarStore((s) => s.annotationSelected);
  const annotationDeselected = useToolbarStore((s) => s.annotationDeselected);
  const exportModalOpened = useToolbarStore((s) => s.exportModalOpened);
  const exportModalClosed = useToolbarStore((s) => s.exportModalClosed);
  const entranceCompleted = useToolbarStore((s) => s.entranceCompleted);
  const uiHidden = useToolbarStore((s) => s.uiHidden);
  const uiShown = useToolbarStore((s) => s.uiShown);
  const toggleCategoryPanel = useToolbarStore((s) => s.toggleCategoryPanel);
  const selectionModeCancelled = useToolbarStore((s) => s.selectionModeCancelled);
  const categoryPanelClosed = useToolbarStore((s) => s.categoryPanelClosed);

  // Annotations store
  const annotations = useAnnotationsStore((s) => s.annotations);
  const loadAnnotations = useAnnotationsStore((s) => s.loadAnnotations);
  const annotationCreated = useAnnotationsStore((s) => s.annotationCreated);
  const annotationDeleted = useAnnotationsStore((s) => s.annotationDeleted);
  const annotationsCleared = useAnnotationsStore((s) => s.annotationsCleared);

  // Derived state
  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId]
  );
  const isSelectingElement = addMode === 'selecting';
  const isCategoryPanelOpen = addMode === 'category';
  const hasSelectedAnnotation = Boolean(selectedAnnotation);

  // Local state (component-specific)
  const [savedToolbarPosition, setSavedToolbarPosition] = useState<Position | null>(null);
  const [tooltipsReady, setTooltipsReady] = useState(false);
  const tooltipDelayTimerRef = useRef<number | null>(null);

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
      annotationDeselected();
    }
  }, [selectedAnnotationId, selectedAnnotation, annotationDeselected]);

  // Handle position persistence
  const handleToolbarPositionChange = useCallback((position: Position) => {
    saveToolbarPosition(position).catch(console.error);
  }, []);

  // Load initial data
  useEffect(() => {
    let isCancelled = false;

    const loadInitialData = async () => {
      try {
        const position = await loadToolbarPosition();
        if (!isCancelled) {
          setSavedToolbarPosition(position);
        }
      } catch (error) {
        console.error('Failed to load toolbar position:', error);
      }
    };
    loadInitialData();
    loadAnnotations();

    return () => {
      isCancelled = true;
    };
  }, [loadAnnotations]);

  // Entrance animation complete
  useEffect(() => {
    const timer = setTimeout(() => entranceCompleted(), 500);
    return () => clearTimeout(timer);
  }, [entranceCompleted]);

  // Listen for external events
  useEffect(() => {
    const handleExportMessage = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type === 'TRIGGER_EXPORT') {
        exportModalOpened();
      }
    };
    browser.runtime.onMessage.addListener(handleExportMessage);

    const offHide = onUiEvent('hide-ui', () => uiHidden());
    const offShow = onUiEvent('show-ui', () => uiShown());
    const offOpen = onUiEvent('open-export', () => exportModalOpened());

    return () => {
      browser.runtime.onMessage.removeListener(handleExportMessage);
      offHide();
      offShow();
      offOpen();
    };
  }, [exportModalOpened, uiHidden, uiShown]);

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

      elementSelected({
        x: isFixed ? centerX : centerX + scrollLeft,
        y: isFixed ? centerY : centerY + scrollTop,
        element: name,
        elementPath: path,
        target,
        rect,
        isFixed,
        scrollX: scrollLeft,
        scrollY: scrollTop,
      });
    };

    document.addEventListener('click', handleAddModeClick, true);
    return () => document.removeEventListener('click', handleAddModeClick, true);
  }, [isSelectingElement, elementSelected]);

  // Body class for crosshair cursor
  useEffect(() => {
    if (isSelectingElement) {
      document.body.classList.add('designer-feedback-add-mode');
    } else {
      document.body.classList.remove('designer-feedback-add-mode');
    }
    return () => document.body.classList.remove('designer-feedback-add-mode');
  }, [isSelectingElement]);

  // Escape key handler - closes panels/selections in priority order
  type EscapeState = {
    hasSelectedAnnotation: boolean;
    isSelectingElement: boolean;
    pendingAnnotation: PendingAnnotation | null;
    isCategoryPanelOpen: boolean;
  };

  const escapeState: EscapeState = useMemo(
    () => ({
      hasSelectedAnnotation,
      isSelectingElement,
      pendingAnnotation,
      isCategoryPanelOpen,
    }),
    [hasSelectedAnnotation, isSelectingElement, pendingAnnotation, isCategoryPanelOpen]
  );

  const escapeHandlers = useMemo(
    () => [
      {
        condition: (s: EscapeState) => s.isCategoryPanelOpen,
        handler: () => categoryPanelClosed(),
      },
      {
        condition: (s: EscapeState) => s.hasSelectedAnnotation,
        handler: () => annotationDeselected(),
      },
      {
        condition: (s: EscapeState) => Boolean(s.pendingAnnotation),
        handler: () => pendingAnnotationCleared(),
      },
      {
        condition: (s: EscapeState) => s.isSelectingElement,
        handler: () => selectionModeCancelled(),
      },
    ],
    [categoryPanelClosed, annotationDeselected, pendingAnnotationCleared, selectionModeCancelled]
  );

  useEscapeKey(escapeState, escapeHandlers);

  // Click outside handler for selected annotation
  const handleClickOutside = useCallback(() => {
    annotationDeselected();
  }, [annotationDeselected]);

  const clickOutsideSelectors = useMemo(
    () => ['data-annotation-popup', 'data-annotation-marker', 'data-toolbar'],
    []
  );

  useClickOutside(Boolean(selectedAnnotation), clickOutsideSelectors, handleClickOutside);

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

      await annotationCreated(newAnnotation);
      pendingAnnotationCleared();
    },
    [pendingAnnotation, selectedCategory, annotationCreated, pendingAnnotationCleared]
  );

  const handleDeleteAnnotation = useCallback(
    async (id: string) => {
      await annotationDeleted(id);
      if (selectedAnnotationId === id) {
        annotationDeselected();
      }
    },
    [selectedAnnotationId, annotationDeleted, annotationDeselected]
  );

  const handleClearAllAnnotations = useCallback(async () => {
    await annotationsCleared();
    startTransition(() => {
      annotationDeselected();
    });
  }, [annotationsCleared, annotationDeselected]);

  const handleCategorySelect = useCallback(
    (category: FeedbackCategory) => {
      categorySelected(category);
    },
    [categorySelected]
  );

  const handleMarkerClick = useCallback(
    (id: string) => {
      annotationSelected(id);
    },
    [annotationSelected]
  );

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

  // Hide all UI during screenshot
  if (isHidden) {
    return null;
  }

  const darkModeClassName = !lightMode ? 'dark' : '';

  return createPortal(
    <div className={clsx('font-sans df-root', darkModeClassName)}>
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
            onCancel={() => pendingAnnotationCleared()}
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
              annotationDeselected();
            }}
            onCancel={() => annotationDeselected()}
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
              onClose={() => exportModalClosed()}
              lightMode={lightMode}
              shadowRoot={shadowRoot}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <Toolbar
        isExpanded={isExpanded}
        isEntranceComplete={isEntranceComplete}
        annotationsCount={annotations.length}
        onExpandedChange={handleExpandedChange}
        onAddClick={toggleCategoryPanel}
        onExportClick={() => startTransition(() => exportModalOpened())}
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
