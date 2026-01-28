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
import type { Annotation } from '@/types';
import styles from './styles.module.scss';

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
      lightMode = false,
    },
    ref
  ) {
    const [text, setText] = useState(initialValue);
    const [isShaking, setIsShaking] = useState(false);
    const [animState, setAnimState] = useState<'initial' | 'enter' | 'entered' | 'exit'>(
      'initial'
    );
    const [isFocused, setIsFocused] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Sync with parent exit state
    useEffect(() => {
      if (isExiting && animState !== 'exit') {
        setAnimState('exit');
      }
    }, [isExiting, animState]);

    // Animate in on mount and focus textarea
    useEffect(() => {
      requestAnimationFrame(() => {
        setAnimState('enter');
      });
      const enterTimer = setTimeout(() => {
        setAnimState('entered');
      }, 200);
      const focusTimer = setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
          textarea.scrollTop = textarea.scrollHeight;
        }
      }, 50);
      return () => {
        clearTimeout(enterTimer);
        clearTimeout(focusTimer);
      };
    }, []);

    // Shake animation
    const shake = useCallback(() => {
      setIsShaking(true);
      setTimeout(() => {
        setIsShaking(false);
        textareaRef.current?.focus();
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
      setAnimState('exit');
      setTimeout(() => {
        onCancel();
      }, 150);
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

    const popupClassName = [
      styles.popup,
      lightMode ? styles.light : '',
      animState === 'enter' ? styles.enter : '',
      animState === 'entered' ? styles.entered : '',
      animState === 'exit' ? styles.exit : '',
      isShaking ? styles.shake : '',
    ]
      .filter(Boolean)
      .join(' ');

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

    // View mode: show annotation details with delete option
    if (mode === 'view' && annotation) {
      return (
        <div
          ref={popupRef}
          className={popupClassName}
          data-annotation-popup
          style={resolvedStyle}
          role="dialog"
          aria-label="Annotation details"
          tabIndex={-1}
        >
          <div className={styles.header}>
            <span className={styles.element}>{element}</span>
          </div>

          <div className={styles.comment}>{annotation.comment}</div>

          <div className={styles.actions}>
            <button className={styles.cancel} type="button" onClick={handleCancel}>
              Close
            </button>
            <button
              className={styles.delete}
              type="button"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      );
    }

    // Create mode: show form to add new annotation
    return (
      <div
        ref={popupRef}
        className={popupClassName}
        data-annotation-popup
        style={resolvedStyle}
        role="dialog"
        aria-label="Create annotation"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <span className={styles.element}>{element}</span>
        </div>

        {selectedText && (
          <div className={styles.quote}>
            &ldquo;{selectedText.slice(0, 80)}
            {selectedText.length > 80 ? '...' : ''}&rdquo;
          </div>
        )}

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          style={{ borderColor: isFocused ? accentColor : undefined }}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={2}
          onKeyDown={handleKeyDown}
        />

        <div className={styles.actions}>
          <button className={styles.cancel} type="button" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className={styles.submit}
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
      </div>
    );
  }
);

export default AnnotationPopup;
