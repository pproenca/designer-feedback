import {useCallback, useEffect, useMemo, useState, lazy, Suspense} from 'react';
import {createPortal} from 'react-dom';
import {AnimatePresence} from 'framer-motion';
import {useShallow} from 'zustand/react/shallow';
import {AnnotationPopup} from '../AnnotationPopup';
import {Toolbar} from './Toolbar';
import {CategoryPanel} from './CategoryPanel';
import {SelectionOverlay} from '../SelectionOverlay';
import {AnnotationLayer} from '../AnnotationLayer';
import {onUiEvent} from '@/utils/ui-events';
import {
  identifyElement,
  hasFixedPositioning,
} from '@/utils/dom/element-identification';
import {
  calculatePopupPosition,
  getPopupDisplayPosition,
} from '@/utils/annotation-position';
import {clsx} from 'clsx';
import type {Annotation} from '@/types';
import {useEscapeKey} from '@/hooks/useEscapeKey';
import {useClickOutside} from '@/hooks/useClickOutside';
import {useSettings} from '@/hooks/useSettings';
import type {PendingAnnotation} from './context';
import {subscribeResumeExportRequests} from '@/utils/resume-export-queue';
import type {ResumeExportRequest} from '@/utils/messaging';

import {useAnnotationsStore} from '@/stores/annotations';
import {
  ToolbarStateProvider,
  useToolbarActions,
  useToolbarState,
} from './ToolbarStateProvider';
import {ToastProvider, ToastViewport} from '@/components/Toast';

const ExportModal = lazy(() =>
  import('../ExportModal').then(m => ({default: m.ExportModal}))
);

interface FeedbackToolbarProps {
  shadowRoot: ShadowRoot;
}

export function FeedbackToolbar(props: FeedbackToolbarProps) {
  return (
    <ToolbarStateProvider>
      <ToastProvider>
        <FeedbackToolbarContent {...props} />
      </ToastProvider>
    </ToolbarStateProvider>
  );
}

function FeedbackToolbarContent({shadowRoot}: FeedbackToolbarProps) {
  const {settings} = useSettings();
  const lightMode = settings.lightMode;
  const [isCaptureActive, setCaptureActive] = useState(false);
  const [autoStartRequest, setAutoStartRequest] =
    useState<ResumeExportRequest | null>(null);
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

  const {annotations, loadAnnotations, annotationCreated, annotationDeleted} =
    useAnnotationsStore(
      useShallow(s => ({
        annotations: s.annotations,
        loadAnnotations: s.loadAnnotations,
        annotationCreated: s.annotationCreated,
        annotationDeleted: s.annotationDeleted,
      }))
    );

  const selectedAnnotation = useMemo(
    () =>
      annotations.find(annotation => annotation.id === selectedAnnotationId) ??
      null,
    [annotations, selectedAnnotationId]
  );
  const isSelectingElement = addMode === 'selecting';
  const isCategoryPanelOpen = addMode === 'category';
  const hasSelectedAnnotation = Boolean(selectedAnnotation);

  useEffect(() => {
    if (selectedAnnotationId && !selectedAnnotation) {
      annotationDeselected();
    }
  }, [selectedAnnotationId, selectedAnnotation, annotationDeselected]);

  useEffect(() => {
    void loadAnnotations();
  }, [loadAnnotations]);

  useEffect(() => {
    const timer = setTimeout(() => entranceCompleted(), 500);
    return () => clearTimeout(timer);
  }, [entranceCompleted]);

  useEffect(() => {
    const host = shadowRoot.host as HTMLElement | null;
    if (!host) return;
    if (isCaptureActive) {
      host.setAttribute('data-capture', 'true');
    } else {
      host.removeAttribute('data-capture');
    }
    return () => host.removeAttribute('data-capture');
  }, [isCaptureActive, shadowRoot]);

  useEffect(() => {
    const offHide = onUiEvent('hide-ui', () => uiHidden());
    const offShow = onUiEvent('show-ui', () => uiShown());
    const offOpen = onUiEvent('open-export', () => exportModalOpened());
    const offLocation = onUiEvent('location-changed', () => {
      annotationDeselected();
      void loadAnnotations();
    });

    return () => {
      offHide();
      offShow();
      offOpen();
      offLocation();
    };
  }, [
    annotationDeselected,
    exportModalOpened,
    loadAnnotations,
    uiHidden,
    uiShown,
  ]);

  useEffect(() => {
    return subscribeResumeExportRequests(request => {
      setAutoStartRequest(request);
      exportModalOpened();
    });
  }, [exportModalOpened]);

  useEffect(() => {
    if (!isSelectingElement) return undefined;

    const handleAddModeClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.closest('[data-annotation-popup]') ||
        target.closest('[data-toolbar]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const rect = target.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const scrollLeft = window.scrollX;
      const isFixed = hasFixedPositioning(target);
      const clickX = e.clientX;
      const clickY = e.clientY;

      const {name, path} = identifyElement(target);

      elementSelected({
        x: isFixed ? clickX : clickX + scrollLeft,
        y: isFixed ? clickY : clickY + scrollTop,
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
    return () =>
      document.removeEventListener('click', handleAddModeClick, true);
  }, [isSelectingElement, elementSelected]);

  useEffect(() => {
    if (isSelectingElement) {
      document.body.classList.add('designer-feedback-add-mode');
    } else {
      document.body.classList.remove('designer-feedback-add-mode');
    }
    return () => document.body.classList.remove('designer-feedback-add-mode');
  }, [isSelectingElement]);

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
    [
      hasSelectedAnnotation,
      isSelectingElement,
      pendingAnnotation,
      isCategoryPanelOpen,
    ]
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
    [
      categoryPanelClosed,
      annotationDeselected,
      pendingAnnotationCleared,
      selectionModeCancelled,
    ]
  );

  useEscapeKey(escapeState, escapeHandlers);

  const handleClickOutside = useCallback(() => {
    annotationDeselected();
  }, [annotationDeselected]);

  const clickOutsideSelectors = useMemo(
    () => ['data-annotation-popup', 'data-annotation-marker', 'data-toolbar'],
    []
  );

  useClickOutside(
    Boolean(selectedAnnotation),
    clickOutsideSelectors,
    handleClickOutside
  );

  const handleAnnotationSubmit = useCallback(
    async (comment: string) => {
      if (!pendingAnnotation) return;

      const {scrollX, scrollY, rect} = pendingAnnotation;
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
    [
      pendingAnnotation,
      selectedCategory,
      annotationCreated,
      pendingAnnotationCleared,
    ]
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

  if (isHidden) {
    return null;
  }

  const darkModeClassName = !lightMode ? 'dark' : '';

  return createPortal(
    <div
      className={clsx('font-sans df-root', darkModeClassName)}
      data-capture={isCaptureActive ? 'true' : 'false'}
    >
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
              autoStartRequest={autoStartRequest ?? undefined}
              onAutoStartConsumed={() => setAutoStartRequest(null)}
              onClose={() => exportModalClosed()}
              onCaptureChange={setCaptureActive}
              shadowRoot={shadowRoot}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <Toolbar>
        <CategoryPanel />
      </Toolbar>

      <ToastViewport />
    </div>,
    shadowRoot
  );
}
