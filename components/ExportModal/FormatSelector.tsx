import type { ReactNode, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { ExportFormat } from '@/types';
import { classNames } from '@/utils/classNames';

export type ExportFormatOption = {
  id: ExportFormat;
  label: string;
  description: string;
  icon: ReactNode;
  disabled?: boolean;
  disabledHint?: string;
};

interface FormatSelectorProps {
  options: ExportFormatOption[];
  selectedFormat: ExportFormat;
  isExporting: boolean;
  onFormatSelect: (format: ExportFormat) => void;
  formatOptionsRef: RefObject<HTMLDivElement | null>;
}

export function FormatSelector({
  options,
  selectedFormat,
  isExporting,
  onFormatSelect,
  formatOptionsRef,
}: FormatSelectorProps) {
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'];
    if (!keys.includes(event.key)) return;

    event.preventDefault();
    const buttons = formatOptionsRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    if (!buttons || buttons.length === 0) return;

    const enabledOptions = options.filter((opt) => !opt.disabled);
    const currentIndex = enabledOptions.findIndex((option) => option.id === selectedFormat);
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + delta + enabledOptions.length) % enabledOptions.length;
    const nextOption = enabledOptions[nextIndex];
    onFormatSelect(nextOption.id);
    const fullIndex = options.findIndex((opt) => opt.id === nextOption.id);
    buttons[fullIndex]?.focus();
  };

  return (
    <div className="mb-3.5">
      <h3 className={classNames('text-xs font-semibold mb-2.5 uppercase tracking-widest', 'text-black/45 dark:text-white/50')}>
        Format
      </h3>
      <div
        className="flex flex-col gap-2"
        role="radiogroup"
        aria-label="Export format"
        ref={formatOptionsRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {options.map((option) => {
          const isSelected = selectedFormat === option.id;
          const isDisabled = option.disabled || isExporting;
          return (
            <button
              key={option.id}
              className={classNames(
                'flex items-start gap-3 py-3 px-3.5 border rounded-xl',
                'cursor-pointer text-left relative',
                'transition duration-150 ease-out',
                'active:scale-[0.98]',
                'disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none',
                'focus-ring',
                !isSelected && 'bg-transparent border-transparent hover:bg-df-surface-muted dark:hover:bg-df-dark-muted',
                isSelected && 'bg-df-blue/5 border-df-blue/15',
                isSelected && 'dark:bg-df-blue/10 dark:border-df-blue/20'
              )}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isDisabled}
              onClick={() => onFormatSelect(option.id)}
            >
              {/* Radio indicator */}
              <span
                className={classNames(
                  'flex items-center justify-center w-4.5 h-4.5 rounded-full border-2 shrink-0 mt-0.5',
                  'transition-colors duration-150',
                  !isSelected && 'border-black/20 dark:border-white/25',
                  isSelected && 'border-df-blue dark:border-df-blue'
                )}
              >
                <span
                  className={classNames(
                    'w-2 h-2 rounded-full transition-transform duration-150',
                    isSelected ? 'bg-df-blue scale-100' : 'scale-0'
                  )}
                />
              </span>
              {/* Icon */}
              <span
                className={classNames(
                  'inline-flex items-center justify-center w-8 h-8 rounded-xl leading-none',
                  'transition-colors duration-150',
                  !isSelected && 'bg-black/5 text-black/60',
                  !isSelected && 'dark:bg-white/8 dark:text-white/70',
                  isSelected && 'bg-df-blue/10 text-df-blue',
                  isSelected && 'dark:bg-df-blue/15 dark:text-df-blue'
                )}
              >
                {option.icon}
              </span>
              <div className="flex flex-col gap-0.5 flex-1">
                <span className={classNames('text-sm font-medium', 'text-df-ink dark:text-white')}>
                  {option.label}
                </span>
                <span className={classNames('text-xs leading-snug', 'text-muted-soft')}>
                  {option.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
