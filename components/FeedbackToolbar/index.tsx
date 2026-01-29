import { useState, useCallback, useEffect, useRef, useMemo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

import { AnnotationPopup, AnnotationPopupHandle } from '../AnnotationPopup';
import { useDraggable, type Position } from '@/hooks/useDraggable';
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
import { throttle, debounce } from '@/utils/timing';
import type { Annotation, FeedbackCategory } from '@/types';
import { getCategoryConfig } from '@/shared/categories';

// Performance constants
const HOVER_THROTTLE_MS = 50;
const BADGE_DEBOUNCE_MS = 150;

// Animation variants
const toolbarVariants = {
  hidden: { opacity: 0, y: 6, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 20, delay: 0.4 },
  },
};

const markerVariants = {
  hidden: { opacity: 0, scale: 0.3 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
};

const categoryPanelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -8,
    transition: { duration: 0.1 },
  },
};

const tooltipVariants = {
  hidden: { opacity: 0, scale: 0.91, y: 2 },
  visible: {
    opacity: 1,
    scale: 0.909,
    y: 0,
    transition: { duration: 0.1, ease: 'easeOut' },
  },
};

const hoverHighlightVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.12, ease: 'easeOut' },
  },
};

const hoverTooltipVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.1, ease: 'easeOut' },
  },
};

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
// Utility classes
// =============================================================================

const cn = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(' ');

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
  const [pendingAnnotation, setPendingAnnotation] = useState<PendingAnnotation | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [savedPosition, setSavedPosition] = useState<Position | null>(null);

  // Refs
  const popupRef = useRef<AnnotationPopupHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isAddModeRef = useRef(isAddMode);
  const isMountedRef = useRef(true);

  const selectedAnnotation = useMemo(
    () => annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId]
  );

  useEffect(() => {
    isAddModeRef.current = isAddMode;
  }, [isAddMode]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedAnnotationId && !selectedAnnotation) {
      setSelectedAnnotationId(null);
    }
  }, [selectedAnnotationId, selectedAnnotation]);

  // Handle position persistence
  const handlePositionChange = useCallback((position: Position) => {
    saveToolbarPosition(position).catch((error) => {
      console.error('Failed to save toolbar position:', error);
    });
  }, []);

  // Draggable toolbar
  const {
    position: dragPosition,
    isDragging,
    expandDirection,
    onMouseDown: handleDragMouseDown,
  } = useDraggable({
    elementWidth: 44,
    elementHeight: 44,
    initialPosition: savedPosition,
    onPositionChange: handlePositionChange,
  });

  // Debounced badge update
  const debouncedUpdateBadge = useMemo(
    () => debounce((count: number) => updateBadgeCount(count), BADGE_DEBOUNCE_MS),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateBadge.cancel();
    };
  }, [debouncedUpdateBadge]);

  // Sync badge count with annotations length
  useEffect(() => {
    debouncedUpdateBadge(annotations.length);
  }, [annotations.length, debouncedUpdateBadge]);

  // Load saved toolbar position on mount
  useEffect(() => {
    const loadPosition = async () => {
      try {
        const position = await loadToolbarPosition();
        setSavedPosition(position);
      } catch (error) {
        console.error('Failed to load toolbar position:', error);
      }
    };
    loadPosition();
  }, []);

  // Load annotations on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const loaded = await loadAnnotations();
        setAnnotations(loaded);
      } catch (error) {
        console.error('Failed to load annotations:', error);
      }
    };
    loadData();
  }, []);

  // Entrance animation complete
  useEffect(() => {
    const timer = setTimeout(() => setEntranceComplete(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Listen for export trigger from popup
  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as { type?: string };
      if (msg.type === 'TRIGGER_EXPORT') {
        setShowExportModal(true);
      }
    };
    browser.runtime.onMessage.addListener(handleMessage);
    return () => browser.runtime.onMessage.removeListener(handleMessage);
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
      if (!isMountedRef.current || !isAddModeRef.current) return;

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
    []
  );

  // Handle element hover in add mode
  const handleElementHoverRaw = useCallback(
    (e: MouseEvent) => {
      if (!isMountedRef.current || !isAddModeRef.current) return;

      const target = e.target as HTMLElement;

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
    []
  );

  // Throttled hover handler
  const handleElementHover = useMemo(
    () => throttle(handleElementHoverRaw, HOVER_THROTTLE_MS),
    [handleElementHoverRaw]
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
        e.stopPropagation();
        if (showCategoryPanel) {
          setShowCategoryPanel(false);
        } else if (selectedAnnotationId) {
          setSelectedAnnotationId(null);
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
  }, [isAddMode, pendingAnnotation, selectedAnnotationId, showCategoryPanel]);

  // Close active annotation when clicking outside
  useEffect(() => {
    if (!selectedAnnotationId) return;

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
        setSelectedAnnotationId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [selectedAnnotationId]);

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

      setPendingAnnotation(null);
    },
    [pendingAnnotation, selectedCategory]
  );

  // Handle annotation delete
  const handleDeleteAnnotation = useCallback(
    async (id: string) => {
      try {
        await deleteAnnotation(id);
        setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
        setSelectedAnnotationId((current) => (current === id ? null : current));
      } catch (error) {
        console.error('Failed to delete annotation:', error);
      }
    },
    []
  );

  // Handle clear all
  const handleClearAll = useCallback(async () => {
    try {
      await clearAnnotations();
      setAnnotations([]);
      setSelectedAnnotationId(null);
    } catch (error) {
      console.error('Failed to clear annotations:', error);
    }
  }, []);

  // Toggle category panel
  const toggleCategoryPanel = useCallback(() => {
    if (isAddMode) {
      setIsAddMode(false);
      setHoverInfo(null);
    } else {
      setShowCategoryPanel((prev) => !prev);
    }
    setPendingAnnotation(null);
  }, [isAddMode]);

  // Handle category selection
  const handleCategorySelect = useCallback((category: FeedbackCategory) => {
    setSelectedCategory(category);
    setShowCategoryPanel(false);
    setIsAddMode(true);
  }, []);

  // Render marker tooltip content
  const renderMarkerTooltip = (annotation: Annotation) => {
    const config = getCategoryConfig(annotation.category);
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={tooltipVariants}
        className={cn(
          'absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-[100002]',
          'px-3 py-2 rounded-xl min-w-[120px] max-w-[200px] pointer-events-none cursor-default',
          lightMode
            ? 'bg-white shadow-popup-light'
            : 'bg-[#1a1a1a] shadow-popup'
        )}
      >
        <span
          className="block text-[0.6875rem] font-semibold mb-1"
          style={{ color: config.color }}
        >
          {config.emoji} {config.label}
        </span>
        <span
          className={cn(
            'block text-[13px] font-normal leading-tight whitespace-nowrap overflow-hidden text-ellipsis pb-0.5',
            lightMode ? 'text-black/85' : 'text-white'
          )}
        >
          {annotation.comment}
        </span>
        <span
          className={cn(
            'block text-[0.625rem] font-normal mt-1.5 whitespace-nowrap',
            lightMode ? 'text-black/35' : 'text-white/60'
          )}
        >
          Click to view
        </span>
      </motion.div>
    );
  };

  // Render annotation markers
  const renderMarkers = () => {
    const fixedMarkers = annotations.filter((a) => a.isFixed);
    const absoluteMarkers = annotations.filter((a) => !a.isFixed);

    return (
      <>
        {/* Absolute positioned markers */}
        <div className="absolute top-0 left-0 right-0 h-0 z-[99998] pointer-events-none [&>*]:pointer-events-auto">
          {absoluteMarkers.map((annotation, index) => {
            const config = getCategoryConfig(annotation.category);
            const isHovered = hoveredMarkerId === annotation.id;

            return (
              <motion.div
                key={annotation.id}
                initial={!entranceComplete ? 'hidden' : false}
                animate="visible"
                variants={markerVariants}
                className={cn(
                  'absolute w-[22px] h-[22px] rounded-full flex items-center justify-center',
                  'text-[0.6875rem] font-semibold text-white cursor-pointer select-none',
                  'shadow-marker -translate-x-1/2 -translate-y-1/2 z-[1]',
                  'hover:z-[2] hover:scale-110 transition-transform'
                )}
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                data-annotation-marker
                onMouseEnter={() => setHoveredMarkerId(annotation.id)}
                onMouseLeave={() => setHoveredMarkerId(null)}
                onClick={() => setSelectedAnnotationId(annotation.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedAnnotationId(annotation.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Annotation ${index + 1} (${config.label})`}
              >
                {index + 1}
                <AnimatePresence>
                  {isHovered && renderMarkerTooltip(annotation)}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Fixed positioned markers */}
        <div className="fixed inset-0 z-[99998] pointer-events-none [&>*]:pointer-events-auto">
          {fixedMarkers.map((annotation, index) => {
            const config = getCategoryConfig(annotation.category);
            const isHovered = hoveredMarkerId === annotation.id;
            const globalIndex = absoluteMarkers.length + index + 1;

            return (
              <motion.div
                key={annotation.id}
                initial={!entranceComplete ? 'hidden' : false}
                animate="visible"
                variants={markerVariants}
                className={cn(
                  'fixed w-[22px] h-[22px] rounded-full flex items-center justify-center',
                  'text-[0.6875rem] font-semibold text-white cursor-pointer select-none',
                  'shadow-marker -translate-x-1/2 -translate-y-1/2 z-[1]',
                  'hover:z-[2] hover:scale-110 transition-transform'
                )}
                style={{
                  left: `${annotation.x}px`,
                  top: `${annotation.y}px`,
                  backgroundColor: config.color,
                }}
                data-annotation-marker
                onMouseEnter={() => setHoveredMarkerId(annotation.id)}
                onMouseLeave={() => setHoveredMarkerId(null)}
                onClick={() => setSelectedAnnotationId(annotation.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedAnnotationId(annotation.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Annotation ${globalIndex} (${config.label})`}
              >
                {globalIndex}
                <AnimatePresence>
                  {isHovered && renderMarkerTooltip(annotation)}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Pending marker */}
        {pendingAnnotation && (
          <div
            className={cn(
              'w-[22px] h-[22px] rounded-full flex items-center justify-center',
              'text-[0.6875rem] font-semibold text-white select-none',
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
      <AnimatePresence>
        {isAddMode && hoverInfo?.rect && (
          <div className="fixed inset-0 z-[99997] pointer-events-none [&>*]:pointer-events-auto">
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={hoverHighlightVariants}
              className="fixed border-2 border-df-blue/50 rounded bg-df-blue/4 pointer-events-none box-border"
              style={{
                left: hoverInfo.rect.left,
                top: hoverInfo.rect.top,
                width: hoverInfo.rect.width,
                height: hoverInfo.rect.height,
              }}
            />
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={hoverTooltipVariants}
              className="fixed text-[0.6875rem] font-medium text-white bg-black/85 py-1.5 px-2.5 rounded-md pointer-events-none whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis"
              style={{
                left: hoverInfo.rect.left,
                top: hoverInfo.rect.bottom + 8,
              }}
            >
              {hoverInfo.element}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
            setSelectedAnnotationId(null);
          }}
          onCancel={() => setSelectedAnnotationId(null)}
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
      <div
        ref={toolbarRef}
        className={cn(
          'fixed top-5 right-5 z-[100000] font-sans pointer-events-none',
          isDragging && 'cursor-grabbing [&_*]:cursor-grabbing'
        )}
        data-toolbar
        style={
          dragPosition
            ? expandDirection === 'left'
              ? {
                  top: dragPosition.y,
                  right: window.innerWidth - dragPosition.x - 44,
                  left: 'auto',
                }
              : {
                  top: dragPosition.y,
                  right: 'auto',
                  left: dragPosition.x,
                }
            : undefined
        }
      >
        <motion.div
          initial={!entranceComplete ? 'hidden' : false}
          animate="visible"
          variants={toolbarVariants}
          className={cn(
            'select-none flex items-center justify-center pointer-events-auto cursor-default',
            'transition-[width] duration-400 ease-[cubic-bezier(0.19,1,0.22,1)]',
            // Light/dark mode
            lightMode
              ? 'bg-white text-black/85 shadow-toolbar-light'
              : 'bg-df-dark text-white border border-white/8 shadow-toolbar',
            // Collapsed/expanded state
            isExpanded
              ? 'w-auto h-11 rounded-[1.5rem] p-1.5'
              : cn(
                  'w-11 h-11 rounded-[22px] p-0 cursor-pointer',
                  lightMode ? 'hover:bg-[#f5f5f5]' : 'hover:bg-df-dark-hover',
                  'active:scale-95'
                )
          )}
          onClick={() => !isExpanded && setIsExpanded(true)}
          onKeyDown={(event) => {
            if (!isExpanded && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              setIsExpanded(true);
            }
          }}
          onMouseDown={(e) => {
            handleDragMouseDown(e);
          }}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
        >
          {/* Collapsed state: show icon + badge */}
          <div
            className={cn(
              'absolute flex items-center justify-center transition-[opacity,visibility] duration-100',
              isExpanded
                ? 'opacity-0 invisible pointer-events-none'
                : 'opacity-100 visible pointer-events-auto'
            )}
          >
            <IconList size={20} />
            <AnimatePresence>
              {annotations.length > 0 && !entranceComplete && (
                <motion.span
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={badgeVariants}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-[9px] bg-df-blue text-white text-[0.625rem] font-semibold flex items-center justify-center shadow-sm"
                >
                  {annotations.length}
                </motion.span>
              )}
              {annotations.length > 0 && entranceComplete && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-[9px] bg-df-blue text-white text-[0.625rem] font-semibold flex items-center justify-center shadow-sm">
                  {annotations.length}
                </span>
              )}
            </AnimatePresence>
          </div>

          {/* Expanded state: show controls */}
          <div
            className={cn(
              'flex items-center gap-1.5 transition-[filter,opacity,transform,visibility] duration-350',
              isExpanded
                ? 'opacity-100 blur-0 scale-100 visible pointer-events-auto'
                : 'opacity-0 blur-[6px] scale-60 invisible pointer-events-none'
            )}
          >
            {/* Add annotation button */}
            <div className="relative flex items-center justify-center group">
              <button
                className={cn(
                  'relative cursor-pointer flex items-center justify-center w-[34px] h-[34px] rounded-full border-none',
                  'transition-[background-color,color,transform,opacity] duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                  'disabled:opacity-35 disabled:cursor-not-allowed',
                  lightMode
                    ? cn(
                        'bg-transparent text-black/50',
                        'hover:enabled:bg-black/6 hover:enabled:text-black/85',
                        (isAddMode || showCategoryPanel) && 'text-df-blue bg-df-blue/15'
                      )
                    : cn(
                        'bg-transparent text-white/85',
                        'hover:enabled:bg-white/12 hover:enabled:text-white',
                        (isAddMode || showCategoryPanel) && 'text-df-blue bg-df-blue/25'
                      ),
                  'active:enabled:scale-92'
                )}
                type="button"
                aria-label={isAddMode ? 'Cancel add annotation' : 'Add annotation'}
                aria-pressed={isAddMode || showCategoryPanel}
                aria-expanded={showCategoryPanel}
                onClick={toggleCategoryPanel}
              >
                {isAddMode ? <IconClose size={18} /> : <IconList size={18} />}
              </button>
              <span
                className={cn(
                  'absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 scale-95',
                  'px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap',
                  'opacity-0 invisible pointer-events-none z-[100001]',
                  'transition-[opacity,transform,visibility] duration-135',
                  'group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:delay-850',
                  lightMode
                    ? 'bg-white text-black/85 shadow-tooltip-light'
                    : 'bg-[#1a1a1a] text-white/90 shadow-tooltip',
                  "after:content-[''] after:absolute after:bottom-[calc(100%-4px)] after:left-1/2 after:-translate-x-1/2 after:rotate-45",
                  'after:w-2 after:h-2 after:rounded-tl-sm',
                  lightMode ? 'after:bg-white' : 'after:bg-[#1a1a1a]'
                )}
              >
                {isAddMode ? 'Cancel' : 'Add annotation'}
              </span>

              {/* Category selection panel */}
              <AnimatePresence>
                {showCategoryPanel && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={categoryPanelVariants}
                    className={cn(
                      'absolute top-[calc(100%+12px)] left-1/2 -translate-x-1/2',
                      'rounded-2xl p-3 flex flex-col gap-1 z-[100001] min-w-[140px]',
                      lightMode
                        ? 'bg-white shadow-panel-light'
                        : 'bg-df-dark shadow-panel',
                      "after:content-[''] after:absolute after:-top-1.5 after:left-1/2 after:-translate-x-1/2 after:rotate-45",
                      'after:w-3 after:h-3 after:rounded-tl-sm',
                      lightMode ? 'after:bg-white' : 'after:bg-df-dark'
                    )}
                  >
                    <button
                      className={cn(
                        'flex items-center gap-2.5 py-2.5 px-3.5 border-none bg-transparent text-[13px] font-medium rounded-xl cursor-pointer whitespace-nowrap',
                        'transition-[background-color,color] duration-150',
                        lightMode
                          ? 'text-black/70 hover:bg-black/6 hover:text-black/90'
                          : 'text-white/85 hover:bg-white/10 hover:text-white',
                        '[&:hover_svg]:text-[var(--category-color)]',
                        '[&_svg]:transition-colors [&_svg]:duration-150'
                      )}
                      type="button"
                      onClick={() => handleCategorySelect('bug')}
                      style={{ '--category-color': '#FF3B30' } as CSSProperties}
                    >
                      <IconBug size={20} />
                      <span>Bug</span>
                    </button>
                    <button
                      className={cn(
                        'flex items-center gap-2.5 py-2.5 px-3.5 border-none bg-transparent text-[13px] font-medium rounded-xl cursor-pointer whitespace-nowrap',
                        'transition-[background-color,color] duration-150',
                        lightMode
                          ? 'text-black/70 hover:bg-black/6 hover:text-black/90'
                          : 'text-white/85 hover:bg-white/10 hover:text-white',
                        '[&:hover_svg]:text-[var(--category-color)]',
                        '[&_svg]:transition-colors [&_svg]:duration-150'
                      )}
                      type="button"
                      onClick={() => handleCategorySelect('question')}
                      style={{ '--category-color': '#FFD60A' } as CSSProperties}
                    >
                      <IconQuestion size={20} />
                      <span>Question</span>
                    </button>
                    <button
                      className={cn(
                        'flex items-center gap-2.5 py-2.5 px-3.5 border-none bg-transparent text-[13px] font-medium rounded-xl cursor-pointer whitespace-nowrap',
                        'transition-[background-color,color] duration-150',
                        lightMode
                          ? 'text-black/70 hover:bg-black/6 hover:text-black/90'
                          : 'text-white/85 hover:bg-white/10 hover:text-white',
                        '[&:hover_svg]:text-[var(--category-color)]',
                        '[&_svg]:transition-colors [&_svg]:duration-150'
                      )}
                      type="button"
                      onClick={() => handleCategorySelect('suggestion')}
                      style={{ '--category-color': '#3C82F7' } as CSSProperties}
                    >
                      <IconLightbulb size={20} />
                      <span>Suggestion</span>
                    </button>
                    <button
                      className={cn(
                        'flex items-center gap-2.5 py-2.5 px-3.5 border-none bg-transparent text-[13px] font-medium rounded-xl cursor-pointer whitespace-nowrap',
                        'transition-[background-color,color] duration-150',
                        lightMode
                          ? 'text-black/70 hover:bg-black/6 hover:text-black/90'
                          : 'text-white/85 hover:bg-white/10 hover:text-white',
                        '[&:hover_svg]:text-[var(--category-color)]',
                        '[&_svg]:transition-colors [&_svg]:duration-150'
                      )}
                      type="button"
                      onClick={() => handleCategorySelect('accessibility')}
                      style={{ '--category-color': '#AF52DE' } as CSSProperties}
                    >
                      <IconAccessibility size={20} />
                      <span>Accessibility</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className={cn('w-px h-3 mx-0.5', lightMode ? 'bg-black/10' : 'bg-white/15')} />

            {/* Export button */}
            <div className="relative flex items-center justify-center group">
              <button
                className={cn(
                  'relative cursor-pointer flex items-center justify-center w-[34px] h-[34px] rounded-full border-none',
                  'transition-[background-color,color,transform,opacity] duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                  'disabled:opacity-35 disabled:cursor-not-allowed',
                  lightMode
                    ? 'bg-transparent text-black/50 hover:enabled:bg-black/6 hover:enabled:text-black/85'
                    : 'bg-transparent text-white/85 hover:enabled:bg-white/12 hover:enabled:text-white',
                  'active:enabled:scale-92'
                )}
                type="button"
                aria-label="Export feedback"
                onClick={() => setShowExportModal(true)}
                disabled={annotations.length === 0}
              >
                <IconExport size={18} />
              </button>
              <span
                className={cn(
                  'absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 scale-95',
                  'px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap',
                  'opacity-0 invisible pointer-events-none z-[100001]',
                  'transition-[opacity,transform,visibility] duration-135',
                  'group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:delay-850',
                  'group-has-[button:disabled]:opacity-0 group-has-[button:disabled]:invisible',
                  lightMode
                    ? 'bg-white text-black/85 shadow-tooltip-light'
                    : 'bg-[#1a1a1a] text-white/90 shadow-tooltip',
                  "after:content-[''] after:absolute after:bottom-[calc(100%-4px)] after:left-1/2 after:-translate-x-1/2 after:rotate-45",
                  'after:w-2 after:h-2 after:rounded-tl-sm',
                  lightMode ? 'after:bg-white' : 'after:bg-[#1a1a1a]'
                )}
              >
                Export feedback
              </span>
            </div>

            <div className={cn('w-px h-3 mx-0.5', lightMode ? 'bg-black/10' : 'bg-white/15')} />

            {/* Clear button */}
            <div className="relative flex items-center justify-center group">
              <button
                className={cn(
                  'relative cursor-pointer flex items-center justify-center w-[34px] h-[34px] rounded-full border-none',
                  'transition-[background-color,color,transform,opacity] duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                  'disabled:opacity-35 disabled:cursor-not-allowed',
                  lightMode
                    ? cn(
                        'bg-transparent text-black/50',
                        'hover:enabled:bg-df-red/15 hover:enabled:text-df-red'
                      )
                    : cn(
                        'bg-transparent text-white/85',
                        'hover:enabled:bg-df-red/25 hover:enabled:text-df-red'
                      ),
                  'active:enabled:scale-92'
                )}
                type="button"
                aria-label="Clear all annotations"
                onClick={handleClearAll}
                disabled={annotations.length === 0}
              >
                <IconTrash size={18} />
              </button>
              <span
                className={cn(
                  'absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 scale-95',
                  'px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap',
                  'opacity-0 invisible pointer-events-none z-[100001]',
                  'transition-[opacity,transform,visibility] duration-135',
                  'group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:delay-850',
                  'group-has-[button:disabled]:opacity-0 group-has-[button:disabled]:invisible',
                  lightMode
                    ? 'bg-white text-black/85 shadow-tooltip-light'
                    : 'bg-[#1a1a1a] text-white/90 shadow-tooltip',
                  "after:content-[''] after:absolute after:bottom-[calc(100%-4px)] after:left-1/2 after:-translate-x-1/2 after:rotate-45",
                  'after:w-2 after:h-2 after:rounded-tl-sm',
                  lightMode ? 'after:bg-white' : 'after:bg-[#1a1a1a]'
                )}
              >
                Clear all
              </span>
            </div>

            <div className={cn('w-px h-3 mx-0.5', lightMode ? 'bg-black/10' : 'bg-white/15')} />

            {/* Theme toggle */}
            <div className="relative flex items-center justify-center group">
              <button
                className={cn(
                  'relative cursor-pointer flex items-center justify-center w-[34px] h-[34px] rounded-full border-none',
                  'transition-[background-color,color,transform,opacity] duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                  'disabled:opacity-35 disabled:cursor-not-allowed',
                  lightMode
                    ? 'bg-transparent text-black/50 hover:enabled:bg-black/6 hover:enabled:text-black/85'
                    : 'bg-transparent text-white/85 hover:enabled:bg-white/12 hover:enabled:text-white',
                  'active:enabled:scale-92'
                )}
                type="button"
                aria-label={lightMode ? 'Switch to dark mode' : 'Switch to light mode'}
                onClick={() => onLightModeChange?.(!lightMode)}
              >
                {lightMode ? <IconMoon size={18} /> : <IconSun size={18} />}
              </button>
              <span
                className={cn(
                  'absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 scale-95',
                  'px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap',
                  'opacity-0 invisible pointer-events-none z-[100001]',
                  'transition-[opacity,transform,visibility] duration-135',
                  'group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:delay-850',
                  lightMode
                    ? 'bg-white text-black/85 shadow-tooltip-light'
                    : 'bg-[#1a1a1a] text-white/90 shadow-tooltip',
                  "after:content-[''] after:absolute after:bottom-[calc(100%-4px)] after:left-1/2 after:-translate-x-1/2 after:rotate-45",
                  'after:w-2 after:h-2 after:rounded-tl-sm',
                  lightMode ? 'after:bg-white' : 'after:bg-[#1a1a1a]'
                )}
              >
                {lightMode ? 'Dark mode' : 'Light mode'}
              </span>
            </div>

            {/* Collapse button */}
            <div className="relative flex items-center justify-center group">
              <button
                className={cn(
                  'relative cursor-pointer flex items-center justify-center w-[34px] h-[34px] rounded-full border-none',
                  'transition-[background-color,color,transform,opacity] duration-150',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                  'disabled:opacity-35 disabled:cursor-not-allowed',
                  lightMode
                    ? 'bg-transparent text-black/50 hover:enabled:bg-black/6 hover:enabled:text-black/85'
                    : 'bg-transparent text-white/85 hover:enabled:bg-white/12 hover:enabled:text-white',
                  'active:enabled:scale-92'
                )}
                type="button"
                aria-label="Minimize toolbar"
                onClick={() => setIsExpanded(false)}
              >
                <IconClose size={18} />
              </button>
              <span
                className={cn(
                  'absolute top-[calc(100%+14px)] left-1/2 -translate-x-1/2 scale-95',
                  'px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap',
                  'opacity-0 invisible pointer-events-none z-[100001]',
                  'transition-[opacity,transform,visibility] duration-135',
                  'group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:delay-850',
                  lightMode
                    ? 'bg-white text-black/85 shadow-tooltip-light'
                    : 'bg-[#1a1a1a] text-white/90 shadow-tooltip',
                  "after:content-[''] after:absolute after:bottom-[calc(100%-4px)] after:left-1/2 after:-translate-x-1/2 after:rotate-45",
                  'after:w-2 after:h-2 after:rounded-tl-sm',
                  lightMode ? 'after:bg-white' : 'after:bg-[#1a1a1a]'
                )}
              >
                Minimize
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </>,
    shadowRoot
  );
}

export default FeedbackToolbar;
