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
 * State management is colocated via ToolbarStateProvider (reducer + context).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { AnnotationPopup } from '../AnnotationPopup';
import { Toolbar } from './Toolbar';
import { CategoryPanel } from './CategoryPanel';
import { SelectionOverlay } from '../SelectionOverlay';
import { AnnotationLayer } from '../AnnotationLayer';
import { onUiEvent } from '@/utils/ui-events';
import {
  identifyElement,
  hasFixedPositioning,
} from '@/utils/element-identification';
import {
  calculatePopupPosition,
  getPopupDisplayPosition,
} from '@/utils/annotation-position';
import { clsx } from 'clsx';
import type { Annotation } from '@/types';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useClickOutside } from '@/hooks/useClickOutside';
import type { PendingAnnotation } from './context';

// Zustand stores
import { useAnnotationsStore } from '@/stores/annotations';
import { ToolbarStateProvider, useToolbarActions, useToolbarState } from './ToolbarStateProvider';

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

export function FeedbackToolbar(props: FeedbackToolbarProps) {
  return (
    <ToolbarStateProvider>
      <FeedbackToolbarContent {...props} />
    </ToolbarStateProvider>
  );
}

function FeedbackToolbarContent({
  shadowRoot,
  lightMode = false,
  onLightModeChange,
}: FeedbackToolbarProps) {
  const {
    addMode,
    selectedCategory,
    pendingAnnotation,
    selectedAnnotationId,
    isExportModalOpen,
    isHidden,
  } = useToolbarState();

  const {
    elementSelected,
    pendingAnnotationCleared,
    annotationDeselected,
    exportModalOpened,
    exportModalClosed,
    entranceCompleted,
    uiHidden,
    uiShown,
    selectionModeCancelled,
    categoryPanelClosed,
  } = useToolbarActions();

  const {
    annotations,
    loadAnnotations,
    annotationCreated,
    annotationDeleted,
  } = useAnnotationsStore(
    useShallow((s) => ({
      annotations: s.annotations,
      loadAnnotations: s.loadAnnotations,
      annotationCreated: s.annotationCreated,
      annotationDeleted: s.annotationDeleted,
    }))
  );

  // Derived state
  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId]
  );
  const isSelectingElement = addMode === 'selecting';
  const isCategoryPanelOpen = addMode === 'category';
  const hasSelectedAnnotation = Boolean(selectedAnnotation);

  // Local state (component-specific)
  // Clear stale selected annotation
  useEffect(() => {
    if (selectedAnnotationId && !selectedAnnotation) {
      annotationDeselected();
    }
  }, [selectedAnnotationId, selectedAnnotation, annotationDeselected]);

  // Load initial data
  useEffect(() => {
    loadAnnotations();
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
      annotationDeselected();
    },
    [annotationDeleted, annotationDeselected]
  );

  const createPopupPosition = useMemo(() => {
    if (!pendingAnnotation) return null;
    return calculatePopupPosition({
      rect: pendingAnnotation.rect,
      scrollX: pendingAnnotation.scrollX,
      scrollY: pendingAnnotation.scrollY,
      isFixed: pendingAnnotation.isFixed,
    });
  }, [pendingAnnotation]);

  const viewPopupPosition = useMemo(() => {
    if (!selectedAnnotation) return null;
    return getPopupDisplayPosition(selectedAnnotation);
  }, [selectedAnnotation]);

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
      <AnnotationLayer />

      {/* Annotation popup - create mode */}
      {pendingAnnotation && createPopupPosition ? (
        <AnnotationPopup
          mode="create"
          element={pendingAnnotation.element}
          onSubmit={handleAnnotationSubmit}
          onCancel={() => pendingAnnotationCleared()}
          x={createPopupPosition.x}
          y={createPopupPosition.y}
          isFixed={createPopupPosition.isFixed}
        />
      ) : null}

      {/* Annotation popup - view mode */}
      {selectedAnnotation && viewPopupPosition ? (
        <AnnotationPopup
          mode="view"
          element={selectedAnnotation.element}
          annotation={selectedAnnotation}
          onDelete={() => handleDeleteAnnotation(selectedAnnotation.id)}
          onCancel={() => annotationDeselected()}
          x={viewPopupPosition.x}
          y={viewPopupPosition.y}
          isFixed={viewPopupPosition.isFixed}
        />
      ) : null}

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
        onThemeToggle={() => onLightModeChange?.(!lightMode)}
        lightMode={lightMode}
      >
        <CategoryPanel />
      </Toolbar>
    </div>,
    shadowRoot
  );
}
