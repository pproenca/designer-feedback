import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { m, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { Annotation } from '@/types';
import { classNames } from '@/utils/classNames';

// =============================================================================
// Framer Motion Variants
// =============================================================================

const getPopupVariants = (reduceMotion: boolean): Variants => ({
  hidden: {
    opacity: 0,
    ...(reduceMotion ? {} : { scale: 0.95, y: 4 }),
  },
  visible: {
    opacity: 1,
    ...(reduceMotion ? {} : { scale: 1, y: 0 }),
    transition: reduceMotion
      ? { duration: 0.15, ease: 'easeOut' }
      : {
          type: 'spring',
          stiffness: 500,
          damping: 25,
          mass: 0.8,
        },
  },
  exit: {
    opacity: 0,
    ...(reduceMotion ? {} : { scale: 0.98, y: -4 }),
    transition: {
      duration: reduceMotion ? 0.1 : 0.12,
      ease: 'easeIn',
    },
  },
});

const getShakeVariants = (reduceMotion: boolean): Variants => ({
  shake: reduceMotion
    ? {
        opacity: [1, 0.7, 1],
        transition: { duration: 0.2, ease: 'easeOut' },
      }
    : {
        x: [0, -3, 3, -2, 2, 0],
        transition: { duration: 0.25, ease: 'easeOut' },
      },
});

// =============================================================================
// Types
// =============================================================================

interface AnnotationPopupProps {
  mode?: 'create' | 'view';
  element: string;
  annotation?: Annotation;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  onSubmit?: (text: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
  style?: CSSProperties;
  accentColor?: string;
  isExiting?: boolean;
  lightMode?: boolean;
}

interface AnnotationPopupHandle {
  shake: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const AnnotationPopup = forwardRef<AnnotationPopupHandle, AnnotationPopupProps>(
  function AnnotationPopup(
    {
      mode = 'create',
      element,
      annotation,
      selectedText,
      placeholder = 'What should change?…',
      initialValue = '',
      submitLabel = 'Add',
      onSubmit,
      onDelete,
      onCancel,
      style,
      accentColor = 'var(--color-df-blue)',
      isExiting = false,
      // lightMode is handled by Tailwind dark: variant from parent wrapper
      lightMode: _lightMode = false,
    },
    ref
  ) {
    void _lightMode;
    const [commentText, setCommentText] = useState(initialValue);
    const [isShakeActive, setIsShakeActive] = useState(false);
    const [isTextareaFocused, setIsTextareaFocused] = useState(false);
    const [positionOffset, setPositionOffset] = useState({ x: 0, y: 0 });
    const reduceMotion = useReducedMotion() ?? false;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const autoFocusTimerRef = useRef<number | null>(null);
    const shakeResetTimerRef = useRef<number | null>(null);
    const popupVariants = useMemo(
      () => getPopupVariants(reduceMotion),
      [reduceMotion]
    );
    const shakeVariants = useMemo(
      () => getShakeVariants(reduceMotion),
      [reduceMotion]
    );
    const shakeDurationMs = reduceMotion ? 200 : 250;

    // Focus textarea on mount
    useEffect(() => {
      autoFocusTimerRef.current = window.setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
          textarea.scrollTop = textarea.scrollHeight;
        }
      }, 50);
      return () => {
        if (autoFocusTimerRef.current !== null) {
          clearTimeout(autoFocusTimerRef.current);
          autoFocusTimerRef.current = null;
        }
        if (shakeResetTimerRef.current !== null) {
          clearTimeout(shakeResetTimerRef.current);
          shakeResetTimerRef.current = null;
        }
      };
    }, []);

    // Shake animation
    const shake = useCallback(() => {
      setIsShakeActive(true);
      if (shakeResetTimerRef.current !== null) {
        clearTimeout(shakeResetTimerRef.current);
      }
      shakeResetTimerRef.current = window.setTimeout(() => {
        setIsShakeActive(false);
        textareaRef.current?.focus();
        shakeResetTimerRef.current = null;
      }, shakeDurationMs);
    }, [shakeDurationMs]);

    // Expose shake to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        shake,
      }),
      [shake]
    );

    // Handle cancel with exit animation
    const handleCancel = useCallback(() => {
      onCancel();
    }, [onCancel]);

    // Handle submit
    const handleSubmit = useCallback(() => {
      if (!commentText.trim() || !onSubmit) return;
      onSubmit(commentText.trim());
    }, [commentText, onSubmit]);

    // Handle keyboard
    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        e.stopPropagation(); // Prevent keyboard events from bubbling to host page
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
      },
      [handleSubmit, handleCancel]
    );

    const updatePositionOffset = useCallback(() => {
      const popup = popupRef.current;
      if (!popup) return;

      const rect = popup.getBoundingClientRect();
      const padding = 8;
      const maxX = window.innerWidth - padding;
      const maxY = window.innerHeight - padding;

      let offsetX = 0;
      let offsetY = 0;

      if (rect.left < padding) {
        offsetX = padding - rect.left;
      } else if (rect.right > maxX) {
        offsetX = maxX - rect.right;
      }

      if (rect.top < padding) {
        offsetY = padding - rect.top;
      } else if (rect.bottom > maxY) {
        offsetY = maxY - rect.bottom;
      }

      setPositionOffset((prev) =>
        prev.x === offsetX && prev.y === offsetY ? prev : { x: offsetX, y: offsetY }
      );
    }, []);

    useLayoutEffect(() => {
      updatePositionOffset();
    }, [
      updatePositionOffset,
      style?.left,
      style?.top,
      commentText,
      annotation?.comment,
      selectedText,
      mode,
    ]);

    useEffect(() => {
      window.addEventListener('resize', updatePositionOffset);
      return () => window.removeEventListener('resize', updatePositionOffset);
    }, [updatePositionOffset]);

    const adjustedStyle = useMemo(() => {
      if (!style) return style;

      const hasLeft = style.left !== undefined && style.left !== null;
      const hasTop = style.top !== undefined && style.top !== null;
      const baseLeft = hasLeft
        ? typeof style.left === 'number'
          ? style.left
          : parseFloat(String(style.left))
        : NaN;
      const baseTop = hasTop
        ? typeof style.top === 'number'
          ? style.top
          : parseFloat(String(style.top))
        : NaN;

      const left =
        hasLeft && Number.isFinite(baseLeft)
          ? `${baseLeft + positionOffset.x}px`
          : style.left;
      const top = hasTop && Number.isFinite(baseTop)
        ? `${baseTop + positionOffset.y}px`
        : style.top;

      return {
        ...style,
        left,
        top,
      };
    }, [style, positionOffset]);

    // Base popup classes - uses CSS component class with dark: variants
    const popupClassName = classNames(
      // Layout
      'fixed w-75 -translate-x-1/2 z-panel',
      // Padding & border radius
      'px-4 pt-3 pb-3.5 rounded-2xl',
      // Typography
      'font-sans cursor-default',
      // Light mode (default), dark mode via dark: variant
      'bg-white shadow-panel-light',
      'dark:bg-df-dark dark:shadow-panel'
    );

    // View mode: show annotation details with delete option
    if (mode === 'view' && annotation) {
      return (
        <AnimatePresence mode="wait">
          {!isExiting && (
            <m.div
              ref={popupRef}
              className={popupClassName}
              data-annotation-popup
              style={adjustedStyle}
              role="dialog"
              aria-label="Annotation details"
              tabIndex={-1}
              variants={popupVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <m.div
                variants={shakeVariants}
                animate={isShakeActive ? 'shake' : undefined}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={classNames(
                      'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
                      'text-muted'
                    )}
                  >
                    {element}
                  </span>
                </div>

                {/* Comment */}
                <div
                  className={classNames(
                    'text-sm leading-relaxed py-2 break-words',
                    'text-black/85 dark:text-white/90'
                  )}
                >
                  {annotation.comment}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-1.5 mt-2">
                  <button
                    className={classNames(
                      'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer',
                      'transition-interactive',
                      'focus-ring',
                      'bg-transparent text-muted-soft hover:bg-black/5 hover:text-black/75',
                      'dark:hover:bg-white/10 dark:hover:text-white/80'
                    )}
                    type="button"
                    onClick={handleCancel}
                  >
                    Close
                  </button>
                  <button
                    className={classNames(
                      'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer',
                      'bg-red-500 text-white',
                      'transition-interactive',
                      'hover:bg-red-600',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/50'
                    )}
                    type="button"
                    onClick={onDelete}
                  >
                    Delete
                  </button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      );
    }

    // Create mode: show form to add new annotation
    return (
      <AnimatePresence mode="wait">
        {!isExiting && (
          <m.div
            ref={popupRef}
            className={popupClassName}
            data-annotation-popup
            style={adjustedStyle}
            role="dialog"
            aria-label="Create annotation"
            tabIndex={-1}
            variants={popupVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <m.div
              variants={shakeVariants}
              animate={isShakeActive ? 'shake' : undefined}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={classNames(
                    'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
                    'text-muted'
                  )}
                >
                  {element}
                </span>
              </div>

              {/* Selected text quote */}
              {selectedText && (
                <div
                  className={classNames(
                    'text-xs italic mb-2 py-1.5 px-2 rounded leading-normal',
                    'text-black/55 bg-black/5',
                    'dark:text-white/70 dark:bg-white/5'
                  )}
                >
                  &ldquo;{selectedText.slice(0, 80)}
                  {selectedText.length > 80 ? '…' : ''}&rdquo;
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className={classNames(
                  'w-full py-2 px-2.5 text-sm font-sans rounded-lg resize-none outline-none',
                  'border transition-colors duration-150 ease-out',
                  'focus-ring',
                  // Scrollbar styling
                  '[&::-webkit-scrollbar]:w-1.5',
                  '[&::-webkit-scrollbar-track]:bg-transparent',
                  // Light mode (default)
                  'bg-black/5 text-df-ink border-black/10',
                  'placeholder:text-muted-strong',
                  '[&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-thumb]:rounded-sm',
                  // Dark mode
                  'dark:bg-white/5 dark:text-white dark:border-white/10',
                  'dark:placeholder:text-white/45',
                  'dark:[&::-webkit-scrollbar-thumb]:bg-white/20'
                )}
                style={{ borderColor: isTextareaFocused ? accentColor : undefined }}
                placeholder={placeholder}
                aria-label="Annotation comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                rows={2}
                onKeyDown={handleKeyDown}
              />

              {/* Actions */}
              <div className="flex justify-end gap-1.5 mt-2">
                <button
                  className={classNames(
                    'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer',
                    'transition-interactive',
                    'focus-ring',
                    'bg-transparent text-muted-soft hover:bg-black/5 hover:text-black/75',
                    'dark:hover:bg-white/10 dark:hover:text-white/80'
                  )}
                  type="button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  className={classNames(
                    'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer text-white',
                    'transition duration-150 ease-out',
                    'hover:enabled:brightness-90',
                    'disabled:cursor-not-allowed',
                    'focus-ring'
                  )}
                  style={{
                    backgroundColor: accentColor,
                    opacity: commentText.trim() ? 1 : 0.4,
                  }}
                  type="button"
                  onClick={handleSubmit}
                  disabled={!commentText.trim()}
                >
                  {submitLabel}
                </button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    );
  }
);
