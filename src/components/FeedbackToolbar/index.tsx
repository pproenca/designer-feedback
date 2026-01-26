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
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<PendingAnnotation | null>(
    null
  );
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);

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
      const isFixed = hasFixedPositioning(target);

      const { name, path } = identifyElement(target);

      setPendingAnnotation({
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: isFixed ? rect.top + rect.height / 2 : rect.top + scrollTop + rect.height / 2,
        element: name,
        elementPath: path,
        target,
        rect,
        isFixed,
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
        if (pendingAnnotation) {
          setPendingAnnotation(null);
        } else if (isAddMode) {
          setIsAddMode(false);
          setHoverInfo(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isAddMode, pendingAnnotation]);

  // Handle annotation submit
  const handleAnnotationSubmit = useCallback(
    async (comment: string, category: FeedbackCategory) => {
      if (!pendingAnnotation) return;

      const newAnnotation: Annotation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        x: pendingAnnotation.x,
        y: pendingAnnotation.y,
        comment,
        category,
        element: pendingAnnotation.element,
        elementPath: pendingAnnotation.elementPath,
        timestamp: Date.now(),
        isFixed: pendingAnnotation.isFixed,
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
    [pendingAnnotation, annotations]
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

  // Toggle add mode
  const toggleAddMode = useCallback(() => {
    setIsAddMode((prev) => !prev);
    setHoverInfo(null);
    setPendingAnnotation(null);
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
        <span className={styles.markerHint}>Click to delete</span>
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
                  left: `${annotation.x * 100}%`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                onMouseEnter={() => setHoveredMarkerId(annotation.id)}
                onMouseLeave={() => setHoveredMarkerId(null)}
                onClick={() => handleDeleteAnnotation(annotation.id)}
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
                  left: `${annotation.x * 100}%`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                onMouseEnter={() => setHoveredMarkerId(annotation.id)}
                onMouseLeave={() => setHoveredMarkerId(null)}
                onClick={() => handleDeleteAnnotation(annotation.id)}
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
              left: `${pendingAnnotation.x * 100}%`,
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

      {/* Annotation popup */}
      {pendingAnnotation && (
        <AnnotationPopup
          ref={popupRef}
          element={pendingAnnotation.element}
          onSubmit={handleAnnotationSubmit}
          onCancel={() => setPendingAnnotation(null)}
          lightMode={lightMode}
          style={{
            left: `${pendingAnnotation.x * 100}%`,
            top: pendingAnnotation.isFixed
              ? pendingAnnotation.rect.bottom + 16
              : pendingAnnotation.y + pendingAnnotation.rect.height / 2 + 16,
            position: pendingAnnotation.isFixed ? 'fixed' : 'absolute',
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
                data-active={isAddMode}
                onClick={toggleAddMode}
              >
                {isAddMode ? <IconClose size={18} /> : <IconList size={18} />}
              </button>
              <span className={`${styles.buttonTooltip} ${lightMode ? styles.light : ''}`}>
                {isAddMode ? 'Cancel' : 'Add annotation'}
              </span>
            </div>

            <div className={`${styles.divider} ${lightMode ? styles.light : ''}`} />

            {/* Export button */}
            <div className={styles.buttonWrapper}>
              <button
                className={`${styles.controlButton} ${lightMode ? styles.light : ''}`}
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
