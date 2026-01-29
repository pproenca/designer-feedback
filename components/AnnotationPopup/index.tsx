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
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import type { Annotation } from '@/types';

// =============================================================================
// Utility: conditional class name helper
// =============================================================================

type ClassValue = string | boolean | undefined | null | string[];

function cn(...classes: ClassValue[]): string {
  return classes
    .flat()
    .filter((c): c is string => typeof c === 'string' && c.length > 0)
    .join(' ');
}

// =============================================================================
// Framer Motion Variants
// =============================================================================

const popupVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 4,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 4,
    transition: {
      duration: 0.15,
      ease: 'easeIn',
    },
  },
};

const shakeVariants: Variants = {
  shake: {
    x: [0, -3, 3, -2, 2, 0],
    transition: {
      duration: 0.25,
      ease: 'easeOut',
    },
  },
};

// =============================================================================
// Types
// =============================================================================

export interface AnnotationPopupProps {
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

export interface AnnotationPopupHandle {
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
      placeholder = 'What should change?',
      initialValue = '',
      submitLabel = 'Add',
      onSubmit,
      onDelete,
      onCancel,
      style,
      accentColor = '#3c82f7',
      isExiting = false,
      // lightMode is handled by Tailwind dark: variant from parent wrapper
      lightMode: _lightMode = false,
    },
    ref
  ) {
    void _lightMode;
    const [text, setText] = useState(initialValue);
    const [isShaking, setIsShaking] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const focusTimerRef = useRef<number | null>(null);
    const shakeTimerRef = useRef<number | null>(null);

    // Focus textarea on mount
    useEffect(() => {
      focusTimerRef.current = window.setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
          textarea.scrollTop = textarea.scrollHeight;
        }
      }, 50);
      return () => {
        if (focusTimerRef.current !== null) {
          clearTimeout(focusTimerRef.current);
          focusTimerRef.current = null;
        }
        if (shakeTimerRef.current !== null) {
          clearTimeout(shakeTimerRef.current);
          shakeTimerRef.current = null;
        }
      };
    }, []);

    // Shake animation
    const shake = useCallback(() => {
      setIsShaking(true);
      if (shakeTimerRef.current !== null) {
        clearTimeout(shakeTimerRef.current);
      }
      shakeTimerRef.current = window.setTimeout(() => {
        setIsShaking(false);
        textareaRef.current?.focus();
        shakeTimerRef.current = null;
      }, 250);
    }, []);

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
      if (!text.trim() || !onSubmit) return;
      onSubmit(text.trim());
    }, [text, onSubmit]);

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

    const updateOffset = useCallback(() => {
      const popup = popupRef.current;
      if (!popup) return;

      const rect = popup.getBoundingClientRect();
      const padding = 8;
      const maxX = window.innerWidth - padding;
      const maxY = window.innerHeight - padding;

      let dx = 0;
      let dy = 0;

      if (rect.left < padding) {
        dx = padding - rect.left;
      } else if (rect.right > maxX) {
        dx = maxX - rect.right;
      }

      if (rect.top < padding) {
        dy = padding - rect.top;
      } else if (rect.bottom > maxY) {
        dy = maxY - rect.bottom;
      }

      setOffset((prev) => (prev.x === dx && prev.y === dy ? prev : { x: dx, y: dy }));
    }, []);

    useLayoutEffect(() => {
      updateOffset();
    }, [updateOffset, style?.left, style?.top, text, annotation?.comment, selectedText, mode]);

    useEffect(() => {
      window.addEventListener('resize', updateOffset);
      return () => window.removeEventListener('resize', updateOffset);
    }, [updateOffset]);

    const resolvedStyle = useMemo(() => {
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
        hasLeft && Number.isFinite(baseLeft) ? `${baseLeft + offset.x}px` : style.left;
      const top = hasTop && Number.isFinite(baseTop) ? `${baseTop + offset.y}px` : style.top;

      return {
        ...style,
        left,
        top,
      };
    }, [style, offset]);

    // Base popup classes - uses CSS component class with dark: variants
    const popupClasses = cn(
      // Layout
      'fixed w-[300px] -translate-x-1/2 z-panel',
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
            <motion.div
              ref={popupRef}
              className={popupClasses}
              data-annotation-popup
              style={resolvedStyle}
              role="dialog"
              aria-label="Annotation details"
              tabIndex={-1}
              variants={popupVariants}
              initial="hidden"
              animate={isShaking ? 'shake' : 'visible'}
              exit="exit"
            >
              <motion.div
                variants={shakeVariants}
                animate={isShaking ? 'shake' : undefined}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={cn(
                      'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
                      'text-black/60 dark:text-white/65'
                    )}
                  >
                    {element}
                  </span>
                </div>

                {/* Comment */}
                <div
                  className={cn(
                    'text-[0.8125rem] leading-relaxed py-2 break-words',
                    'text-black/85 dark:text-white/[0.92]'
                  )}
                >
                  {annotation.comment}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-1.5 mt-2">
                  <button
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer',
                      'transition-colors duration-150 ease-out',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                      'bg-transparent text-black/50 hover:bg-black/[0.06] hover:text-black/75',
                      'dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white/80'
                    )}
                    type="button"
                    onClick={handleCancel}
                  >
                    Close
                  </button>
                  <button
                    className={cn(
                      'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer',
                      'bg-red-500 text-white',
                      'transition-colors duration-150 ease-out',
                      'hover:bg-red-600',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500/50'
                    )}
                    type="button"
                    onClick={onDelete}
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      );
    }

    // Create mode: show form to add new annotation
    return (
      <AnimatePresence mode="wait">
        {!isExiting && (
          <motion.div
            ref={popupRef}
            className={popupClasses}
            data-annotation-popup
            style={resolvedStyle}
            role="dialog"
            aria-label="Create annotation"
            tabIndex={-1}
            variants={popupVariants}
            initial="hidden"
            animate={isShaking ? 'shake' : 'visible'}
            exit="exit"
          >
            <motion.div
              variants={shakeVariants}
              animate={isShaking ? 'shake' : undefined}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={cn(
                    'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
                    'text-black/60 dark:text-white/65'
                  )}
                >
                  {element}
                </span>
              </div>

              {/* Selected text quote */}
              {selectedText && (
                <div
                  className={cn(
                    'text-xs italic mb-2 py-1.5 px-2 rounded leading-[1.45]',
                    'text-black/55 bg-black/[0.04]',
                    'dark:text-white/[0.68] dark:bg-white/[0.04]'
                  )}
                >
                  &ldquo;{selectedText.slice(0, 80)}
                  {selectedText.length > 80 ? '...' : ''}&rdquo;
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className={cn(
                  'w-full py-2 px-2.5 text-[0.8125rem] font-sans rounded-lg resize-none outline-none',
                  'border transition-colors duration-150 ease-out',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                  // Scrollbar styling
                  '[&::-webkit-scrollbar]:w-1.5',
                  '[&::-webkit-scrollbar-track]:bg-transparent',
                  // Light mode (default)
                  'bg-black/[0.03] text-[#1a1a1a] border-black/[0.12]',
                  'placeholder:text-black/40',
                  '[&::-webkit-scrollbar-thumb]:bg-black/15 [&::-webkit-scrollbar-thumb]:rounded-sm',
                  // Dark mode
                  'dark:bg-white/[0.04] dark:text-white dark:border-white/[0.12]',
                  'dark:placeholder:text-white/45',
                  'dark:[&::-webkit-scrollbar-thumb]:bg-white/20'
                )}
                style={{ borderColor: isFocused ? accentColor : undefined }}
                placeholder={placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                rows={2}
                onKeyDown={handleKeyDown}
              />

              {/* Actions */}
              <div className="flex justify-end gap-1.5 mt-2">
                <button
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer',
                    'transition-colors duration-150 ease-out',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50',
                    'bg-transparent text-black/50 hover:bg-black/[0.06] hover:text-black/75',
                    'dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white/80'
                  )}
                  type="button"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                <button
                  className={cn(
                    'px-3.5 py-1.5 text-xs font-medium rounded-full border-none cursor-pointer text-white',
                    'transition-all duration-150 ease-out',
                    'hover:enabled:brightness-90',
                    'disabled:cursor-not-allowed',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-df-blue/50'
                  )}
                  style={{
                    backgroundColor: accentColor,
                    opacity: text.trim() ? 1 : 0.4,
                  }}
                  type="button"
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                >
                  {submitLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

export default AnnotationPopup;
