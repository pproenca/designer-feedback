import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import type { FeedbackCategory } from '@/types';
import { CategorySelector } from '../CategorySelector';
import styles from './styles.module.scss';

// =============================================================================
// Types
// =============================================================================

export interface AnnotationPopupProps {
  element: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  initialCategory?: FeedbackCategory;
  submitLabel?: string;
  onSubmit: (text: string, category: FeedbackCategory) => void;
  onCancel: () => void;
  style?: React.CSSProperties;
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
      element,
      selectedText,
      placeholder = 'What should change?',
      initialValue = '',
      initialCategory = 'suggestion',
      submitLabel = 'Add',
      onSubmit,
      onCancel,
      style,
      accentColor = '#3c82f7',
      isExiting = false,
      lightMode = false,
    },
    ref
  ) {
    const [text, setText] = useState(initialValue);
    const [category, setCategory] = useState<FeedbackCategory>(initialCategory);
    const [isShaking, setIsShaking] = useState(false);
    const [animState, setAnimState] = useState<'initial' | 'enter' | 'entered' | 'exit'>(
      'initial'
    );
    const [isFocused, setIsFocused] = useState(false);
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
      if (!text.trim()) return;
      onSubmit(text.trim(), category);
    }, [text, category, onSubmit]);

    // Handle keyboard
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

    return (
      <div
        ref={popupRef}
        className={popupClassName}
        data-annotation-popup
        style={style}
        onClick={(e) => e.stopPropagation()}
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

        <CategorySelector
          selected={category}
          onChange={setCategory}
          lightMode={lightMode}
        />

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
          <button className={styles.cancel} onClick={handleCancel}>
            Cancel
          </button>
          <button
            className={styles.submit}
            style={{
              backgroundColor: accentColor,
              opacity: text.trim() ? 1 : 0.4,
            }}
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
