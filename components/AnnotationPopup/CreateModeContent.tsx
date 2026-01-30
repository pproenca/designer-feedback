import { useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react';
import { m, type Variants } from 'framer-motion';
import { clsx } from 'clsx';

const BUTTON_BASE = [
  'px-4 py-2 text-xs font-medium rounded-lg border-none cursor-pointer',
  'transition-interactive',
  'focus-ring',
  'active:scale-[0.98]',
].join(' ');

const BUTTON_SECONDARY = clsx(
  BUTTON_BASE,
  'bg-black/5 text-black/60 hover:bg-black/8 hover:text-black/75',
  'dark:bg-white/8 dark:text-white/70 dark:hover:bg-white/12 dark:hover:text-white/85'
);

const ELEMENT_LABEL = clsx(
  'text-xs font-normal max-w-full overflow-hidden text-ellipsis whitespace-nowrap flex-1',
  'text-muted'
);

interface CreateModeContentProps {
  element: string;
  selectedText?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  accentColor?: string;
  isShakeActive: boolean;
  shakeVariants: Variants;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function CreateModeContent({
  element,
  selectedText,
  placeholder = 'What should change?…',
  initialValue = '',
  submitLabel = 'Add',
  accentColor = 'var(--color-df-blue)',
  isShakeActive,
  shakeVariants,
  onSubmit,
  onCancel,
}: CreateModeContentProps) {
  const [commentText, setCommentText] = useState(initialValue);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFocusTimerRef = useRef<number | null>(null);

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
    };
  }, []);

  const handleSubmit = useCallback(() => {
    if (!commentText.trim()) return;
    onSubmit(commentText.trim());
  }, [commentText, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.nativeEvent.isComposing) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <m.div variants={shakeVariants} animate={isShakeActive ? 'shake' : undefined}>
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
        className={clsx(
          'w-full py-2 px-2.5 text-sm font-sans rounded-lg resize-none outline-none',
          'border transition-all duration-200 ease-out',
          'custom-scrollbar',
          'bg-black/5 text-df-ink border-black/10 placeholder:text-muted-strong',
          'dark:bg-white/5 dark:text-white dark:border-white/10 dark:placeholder:text-white/45'
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
        <button className={BUTTON_SECONDARY} type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className={clsx(
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
  );
}
