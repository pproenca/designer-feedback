import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { AnnotationPopup, AnnotationPopupHandle } from '../AnnotationPopup';
import {
  IconList,
  IconClose,
  IconTrash,
  IconExport,
  IconSun,
  IconMoon,
  IconBug,
  IconLightbulb,
  IconQuestion,
} from '../Icons';
import { ExportModal } from '../ExportModal';
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
// Note: captureScreenshot is used at export time, not during annotation creation
import type { Annotation, FeedbackCategory } from '@/types';
import { getCategoryConfig } from '@/shared/categories';
import styles from './styles.module.scss';

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
  elementPath: string;
  rect: DOMRect | null;
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
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddMode, setIsAddMode] = useState(false);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory>('suggestion');
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<PendingAnnotation | null>(
    null
  );
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Refs
  const popupRef = useRef<AnnotationPopupHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Load annotations on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const loaded = await loadAnnotations();
        setAnnotations(loaded);
        updateBadgeCount(loaded.length);
      } catch (error) {
        console.error('Failed to load annotations:', error);
      }
    };
    loadData();

    // Entrance animation complete
    const timer = setTimeout(() => setEntranceComplete(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Listen for export trigger from popup
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'TRIGGER_EXPORT') {
        setShowExportModal(true);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Listen for hide/show events from export functions
  useEffect(() => {
    const handleHide = () => setHidden(true);
    const handleShow = () => setHidden(false);
    const handleOpenExport = () => setShowExportModal(true);

    document.addEventListener('designer-feedback:hide-ui', handleHide);
    document.addEventListener('designer-feedback:show-ui', handleShow);
    document.addEventListener('designer-feedback:open-export', handleOpenExport);

    return () => {
      document.removeEventListener('designer-feedback:hide-ui', handleHide);
      document.removeEventListener('designer-feedback:show-ui', handleShow);
      document.removeEventListener('designer-feedback:open-export', handleOpenExport);
    };
  }, []);

  // Handle element click in add mode
  const handleElementClick = useCallback(
    async (e: MouseEvent) => {
      if (!isAddMode) return;

      const target = e.target as HTMLElement;

      // Ignore clicks on our own UI
      if (target.closest('[data-annotation-popup]') || target.closest('[data-toolbar]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Calculate position
      const rect = target.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const scrollLeft = window.scrollX;
      const isFixed = hasFixedPositioning(target);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const { name, path } = identifyElement(target);

      setPendingAnnotation({
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

      setIsAddMode(false);
      setHoverInfo(null);
    },
    [isAddMode]
  );

  // Handle element hover in add mode
  const handleElementHover = useCallback(
    (e: MouseEvent) => {
      if (!isAddMode) return;

      const target = e.target as HTMLElement;

      // Ignore our own UI
      if (target.closest('[data-annotation-popup]') || target.closest('[data-toolbar]')) {
        setHoverInfo(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const { name, path } = identifyElement(target);

      setHoverInfo({
        element: name,
        elementPath: path,
        rect,
      });
    },
    [isAddMode]
  );

  // Set up hover and click listeners
  useEffect(() => {
    if (isAddMode) {
      document.addEventListener('mouseover', handleElementHover);
      document.addEventListener('click', handleElementClick, true);

      return () => {
        document.removeEventListener('mouseover', handleElementHover);
        document.removeEventListener('click', handleElementClick, true);
      };
    }
    return undefined;
  }, [isAddMode, handleElementHover, handleElementClick]);

  // Toggle body class for crosshair cursor in add mode
  useEffect(() => {
    if (isAddMode) {
      document.body.classList.add('designer-feedback-add-mode');
    } else {
      document.body.classList.remove('designer-feedback-add-mode');
    }

    return () => {
      document.body.classList.remove('designer-feedback-add-mode');
    };
  }, [isAddMode]);

  // Cancel add mode on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // Prevent Escape from triggering host page behavior
        if (showCategoryPanel) {
          setShowCategoryPanel(false);
        } else if (selectedAnnotation) {
          setSelectedAnnotation(null);
        } else if (pendingAnnotation) {
          setPendingAnnotation(null);
        } else if (isAddMode) {
          setIsAddMode(false);
          setHoverInfo(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isAddMode, pendingAnnotation, selectedAnnotation, showCategoryPanel]);

  // Close active annotation when clicking outside of the annotation UI
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
        setSelectedAnnotation(null);
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
        const updatedAnnotations = [...annotations, newAnnotation];
        setAnnotations(updatedAnnotations);
        updateBadgeCount(updatedAnnotations.length);
      } catch (error) {
        console.error('Failed to save annotation:', error);
      }

      setPendingAnnotation(null);
    },
    [pendingAnnotation, annotations, selectedCategory]
  );

  // Handle annotation delete
  const handleDeleteAnnotation = useCallback(
    async (id: string) => {
      try {
        await deleteAnnotation(id);
        const updatedAnnotations = annotations.filter((a) => a.id !== id);
        setAnnotations(updatedAnnotations);
        updateBadgeCount(updatedAnnotations.length);
      } catch (error) {
        console.error('Failed to delete annotation:', error);
      }
    },
    [annotations]
  );

  // Handle clear all
  const handleClearAll = useCallback(async () => {
    try {
      await clearAnnotations();
      setAnnotations([]);
      updateBadgeCount(0);
    } catch (error) {
      console.error('Failed to clear annotations:', error);
    }
  }, []);

  // Toggle category panel
  const toggleCategoryPanel = useCallback(() => {
    if (isAddMode) {
      // If in add mode, cancel it
      setIsAddMode(false);
      setHoverInfo(null);
    } else {
      // Toggle the category panel
      setShowCategoryPanel((prev) => !prev);
    }
    setPendingAnnotation(null);
  }, [isAddMode]);

  // Handle category selection - enters add mode with selected category
  const handleCategorySelect = useCallback((category: FeedbackCategory) => {
    setSelectedCategory(category);
    setShowCategoryPanel(false);
    setIsAddMode(true);
  }, []);

  // Render marker tooltip content
  const renderMarkerTooltip = (annotation: Annotation) => {
    const config = getCategoryConfig(annotation.category);
    return (
      <div className={`${styles.markerTooltip} ${lightMode ? styles.light : ''} ${styles.enter}`}>
        <span className={styles.markerCategory} style={{ color: config.color }}>
          {config.emoji} {config.label}
        </span>
        <span className={styles.markerNote}>{annotation.comment}</span>
        <span className={styles.markerHint}>Click to view</span>
      </div>
    );
  };

  // Render annotation markers
  const renderMarkers = () => {
    // Group by fixed vs absolute positioning
    const fixedMarkers = annotations.filter((a) => a.isFixed);
    const absoluteMarkers = annotations.filter((a) => !a.isFixed);

    return (
      <>
        {/* Absolute positioned markers (scroll with page) */}
        <div className={styles.markersLayer}>
          {absoluteMarkers.map((annotation, index) => {
            const config = getCategoryConfig(annotation.category);
            const isHovered = hoveredMarkerId === annotation.id;

            return (
              <div
                key={annotation.id}
                className={`${styles.marker} ${entranceComplete ? '' : styles.enter}`}
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                data-annotation-marker
                onMouseEnter={() => setHoveredMarkerId(annotation.id)}
                onMouseLeave={() => setHoveredMarkerId(null)}
                onClick={() => setSelectedAnnotation(annotation)}
              >
                {index + 1}
                {isHovered && renderMarkerTooltip(annotation)}
              </div>
            );
          })}
        </div>

        {/* Fixed positioned markers (stay in viewport) */}
        <div className={styles.fixedMarkersLayer}>
          {fixedMarkers.map((annotation, index) => {
            const config = getCategoryConfig(annotation.category);
            const isHovered = hoveredMarkerId === annotation.id;
            const globalIndex = absoluteMarkers.length + index + 1;

            return (
              <div
                key={annotation.id}
                className={`${styles.marker} ${styles.fixed} ${entranceComplete ? '' : styles.enter}`}
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                data-annotation-marker
                onMouseEnter={() => setHoveredMarkerId(annotation.id)}
                onMouseLeave={() => setHoveredMarkerId(null)}
                onClick={() => setSelectedAnnotation(annotation)}
              >
                {globalIndex}
                {isHovered && renderMarkerTooltip(annotation)}
              </div>
            );
          })}
        </div>

        {/* Pending marker */}
        {pendingAnnotation && (
          <div
            className={`${styles.marker} ${styles.pending} ${pendingAnnotation.isFixed ? styles.fixed : ''}`}
            style={{
              left: `${pendingAnnotation.x}px`,
              top: pendingAnnotation.isFixed
                ? `${pendingAnnotation.rect.top + pendingAnnotation.rect.height / 2}px`
                : `${pendingAnnotation.y}px`,
              position: pendingAnnotation.isFixed ? 'fixed' : 'absolute',
            }}
          >
            {annotations.length + 1}
          </div>
        )}
      </>
    );
  };

  // Hide all UI during screenshot capture
  if (hidden) {
    return null;
  }

  return createPortal(
    <>
      {/* Hover highlight overlay */}
      {isAddMode && hoverInfo?.rect && (
        <div className={styles.overlay}>
          <div
            className={`${styles.hoverHighlight} ${styles.enter}`}
            style={{
              left: hoverInfo.rect.left,
              top: hoverInfo.rect.top,
              width: hoverInfo.rect.width,
              height: hoverInfo.rect.height,
            }}
          />
          <div
            className={`${styles.hoverTooltip} ${styles.enter}`}
            style={{
              left: hoverInfo.rect.left,
              top: hoverInfo.rect.bottom + 8,
            }}
          >
            {hoverInfo.element}
          </div>
        </div>
      )}

      {/* Annotation markers */}
      {renderMarkers()}

      {/* Annotation popup - create mode */}
      {pendingAnnotation && (
        <AnnotationPopup
          ref={popupRef}
          mode="create"
          element={pendingAnnotation.element}
          onSubmit={handleAnnotationSubmit}
          onCancel={() => setPendingAnnotation(null)}
          lightMode={lightMode}
          style={{
            left: `${pendingAnnotation.x}px`,
            top: pendingAnnotation.isFixed
              ? pendingAnnotation.rect.bottom + 16
              : pendingAnnotation.y + pendingAnnotation.rect.height / 2 + 16,
            position: pendingAnnotation.isFixed ? 'fixed' : 'absolute',
          }}
        />
      )}

      {/* Annotation popup - view mode */}
      {selectedAnnotation && (
        <AnnotationPopup
          mode="view"
          element={selectedAnnotation.element}
          annotation={selectedAnnotation}
          onDelete={() => {
            handleDeleteAnnotation(selectedAnnotation.id);
            setSelectedAnnotation(null);
          }}
          onCancel={() => setSelectedAnnotation(null)}
          lightMode={lightMode}
          style={{
            left: `${selectedAnnotation.x}px`,
            top: selectedAnnotation.isFixed
              ? selectedAnnotation.y + 24
              : selectedAnnotation.y + 24,
            position: selectedAnnotation.isFixed ? 'fixed' : 'absolute',
          }}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          annotations={annotations}
          onClose={() => setShowExportModal(false)}
          lightMode={lightMode}
        />
      )}

      {/* Toolbar */}
      <div ref={toolbarRef} className={styles.toolbar} data-toolbar>
        <div
          className={`
            ${styles.toolbarContainer}
            ${lightMode ? styles.light : ''}
            ${isExpanded ? styles.expanded : styles.collapsed}
            ${!entranceComplete ? styles.entrance : ''}
          `}
          onClick={() => !isExpanded && setIsExpanded(true)}
        >
          {/* Collapsed state: show icon + badge */}
          <div
            className={`${styles.toggleContent} ${isExpanded ? styles.hidden : styles.visible}`}
          >
            <IconList size={20} />
            {annotations.length > 0 && (
              <span className={`${styles.badge} ${!entranceComplete ? styles.entrance : ''}`}>
                {annotations.length}
              </span>
            )}
          </div>

          {/* Expanded state: show controls */}
          <div
            className={`${styles.controlsContent} ${isExpanded ? styles.visible : styles.hidden}`}
          >
            {/* Add annotation button */}
            <div className={styles.buttonWrapper}>
              <button
                className={`${styles.controlButton} ${lightMode ? styles.light : ''}`}
                data-active={isAddMode || showCategoryPanel}
                type="button"
                aria-label={isAddMode ? 'Cancel add annotation' : 'Add annotation'}
                aria-pressed={isAddMode || showCategoryPanel}
                aria-expanded={showCategoryPanel}
                onClick={toggleCategoryPanel}
              >
                {isAddMode ? <IconClose size={18} /> : <IconList size={18} />}
              </button>
              <span className={`${styles.buttonTooltip} ${lightMode ? styles.light : ''}`}>
                {isAddMode ? 'Cancel' : 'Add annotation'}
              </span>

              {/* Category selection panel */}
              {showCategoryPanel && (
                <div className={`${styles.categoryPanel} ${lightMode ? styles.light : ''}`}>
                  <button
                    className={styles.categoryOption}
                    type="button"
                    onClick={() => handleCategorySelect('bug')}
                    style={{ '--category-color': '#FF3B30' } as React.CSSProperties}
                  >
                    <IconBug size={20} />
                    <span>Bug</span>
                  </button>
                  <button
                    className={styles.categoryOption}
                    type="button"
                    onClick={() => handleCategorySelect('question')}
                    style={{ '--category-color': '#FFD60A' } as React.CSSProperties}
                  >
                    <IconQuestion size={20} />
                    <span>Question</span>
                  </button>
                  <button
                    className={styles.categoryOption}
                    type="button"
                    onClick={() => handleCategorySelect('suggestion')}
                    style={{ '--category-color': '#3C82F7' } as React.CSSProperties}
                  >
                    <IconLightbulb size={20} />
                    <span>Suggestion</span>
                  </button>
                </div>
              )}
            </div>

            <div className={`${styles.divider} ${lightMode ? styles.light : ''}`} />

            {/* Export button */}
            <div className={styles.buttonWrapper}>
              <button
                className={`${styles.controlButton} ${lightMode ? styles.light : ''}`}
                type="button"
                aria-label="Export feedback"
                onClick={() => setShowExportModal(true)}
                disabled={annotations.length === 0}
              >
                <IconExport size={18} />
              </button>
              <span className={`${styles.buttonTooltip} ${lightMode ? styles.light : ''}`}>
                Export
              </span>
            </div>

            {/* Clear button */}
            <div className={styles.buttonWrapper}>
              <button
                className={`${styles.controlButton} ${lightMode ? styles.light : ''}`}
                data-danger
                type="button"
                aria-label="Clear all annotations"
                onClick={handleClearAll}
                disabled={annotations.length === 0}
              >
                <IconTrash size={18} />
              </button>
              <span className={`${styles.buttonTooltip} ${lightMode ? styles.light : ''}`}>
                Clear all
              </span>
            </div>

            <div className={`${styles.divider} ${lightMode ? styles.light : ''}`} />

            {/* Theme toggle */}
            <div className={styles.buttonWrapper}>
              <button
                className={`${styles.controlButton} ${lightMode ? styles.light : ''}`}
                type="button"
                aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
                onClick={() => onLightModeChange?.(!lightMode)}
              >
                {lightMode ? <IconMoon size={18} /> : <IconSun size={18} />}
              </button>
              <span className={`${styles.buttonTooltip} ${lightMode ? styles.light : ''}`}>
                {lightMode ? 'Dark mode' : 'Light mode'}
              </span>
            </div>

            {/* Collapse button */}
            <div className={styles.buttonWrapper}>
              <button
                className={`${styles.controlButton} ${lightMode ? styles.light : ''}`}
                type="button"
                aria-label="Minimize toolbar"
                onClick={() => setIsExpanded(false)}
              >
                <IconClose size={18} />
              </button>
              <span className={`${styles.buttonTooltip} ${lightMode ? styles.light : ''}`}>
                Minimize
              </span>
            </div>
          </div>
        </div>
      </div>
    </>,
    shadowRoot
  );
}

export default FeedbackToolbar;
