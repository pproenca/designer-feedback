import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type KeyboardEvent,
} from 'react';
import { m, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import type { Annotation } from '@/types';
import { classNames } from '@/utils/classNames';
import { usePopupPosition } from './usePopupPosition';

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
// Shared Styles
// =============================================================================

const BUTTON_BASE = [
  'px-4 py-2 text-xs font-medium rounded-lg border-none cursor-pointer',
  'transition-interactive',
  'focus-ring',
  'active:scale-[0.98]',
].join(' ');

const BUTTON_SECONDARY = classNames(
  BUTTON_BASE,
  'bg-black/5 text-black/60 hover:bg-black/8 hover:text-black/75',
  'dark:bg-white/8 dark:text-white/70 dark:hover:bg-white/12 dark:hover:text-white/85'
);

const ELEMENT_LABEL = classNames(
  'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
  'text-muted'
);

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
  /** Target x coordinate (center position) */
  x: number;
  /** Target y coordinate (top position) */
  y: number;
  /** Whether to use fixed positioning */
  isFixed: boolean;
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
      x,
      y,
      isFixed,
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
    const reduceMotion = useReducedMotion() ?? false;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
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

    // Use the popup position hook for viewport clamping
    const position = usePopupPosition({ x, y, isFixed });

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

    // Computed style from position hook
    const popupStyle = useMemo(
      () => ({
        left: position.x,
        top: position.y,
        position: position.isFixed ? 'fixed' : 'absolute',
      } as const),
      [position.x, position.y, position.isFixed]
    );

    // Base popup classes - uses CSS component class with dark: variants
    const popupClassName = classNames(
      // Layout (position comes from popupStyle)
      'w-75 -translate-x-1/2 z-panel',
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
              className={popupClassName}
              data-annotation-popup
              style={popupStyle}
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
                  <span className={ELEMENT_LABEL}>{element}</span>
                </div>

                {/* Comment */}
                <div className="text-sm leading-relaxed py-2 break-words text-black/85 dark:text-white/90">
                  {annotation.comment}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-3">
                  <button className={BUTTON_SECONDARY} type="button" onClick={handleCancel}>
                    Close
                  </button>
                  <button
                    className={classNames(
                      BUTTON_BASE,
                      'font-semibold bg-red-500 text-white',
                      'hover:bg-red-600 hover:shadow-[0_2px_8px_rgba(239,68,68,0.25)]',
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
            className={popupClassName}
            data-annotation-popup
            style={popupStyle}
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
                <span className={ELEMENT_LABEL}>{element}</span>
              </div>

              {/* Selected text quote */}
              {selectedText && (
                <div className="text-xs italic mb-2 py-1.5 px-2 rounded leading-normal text-black/55 bg-black/5 dark:text-white/70 dark:bg-white/5">
                  &ldquo;{selectedText.slice(0, 80)}
                  {selectedText.length > 80 ? '…' : ''}&rdquo;
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className={classNames(
                  'w-full py-2 px-2.5 text-sm font-sans rounded-lg resize-none outline-none',
                  'border transition-all duration-200 ease-out',
                  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
                  'bg-black/5 text-df-ink border-black/10 placeholder:text-muted-strong',
                  '[&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-thumb]:rounded-sm',
                  'dark:bg-white/5 dark:text-white dark:border-white/10 dark:placeholder:text-white/45',
                  'dark:[&::-webkit-scrollbar-thumb]:bg-white/20'
                )}
                style={{
                  borderColor: isTextareaFocused ? accentColor : undefined,
                  boxShadow: isTextareaFocused ? `0 0 0 3px color-mix(in srgb, ${accentColor} 15%, transparent)` : undefined,
                }}
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
              <div className="flex justify-end gap-2 mt-3">
                <button className={BUTTON_SECONDARY} type="button" onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  className={classNames(
                    BUTTON_BASE,
                    'font-semibold text-white',
                    'hover:enabled:brightness-110 hover:enabled:shadow-[0_2px_8px_rgba(0,0,0,0.15)]',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                  style={{ backgroundColor: accentColor }}
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
