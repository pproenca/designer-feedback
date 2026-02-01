import {useState, type ReactNode} from 'react';
import {Radio} from '@base-ui/react/radio';
import {RadioGroup} from '@base-ui/react/radio-group';
import type {ExportFormat} from '@/types';
import {clsx} from 'clsx';
import {useExportState, useExportActions} from './ExportContext';

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
}

export function FormatSelector({options}: FormatSelectorProps) {
  const {selectedFormat, isExporting} = useExportState();
  const {dispatch, formatOptionsRef} = useExportActions();

  const [isKeyboardNav, setIsKeyboardNav] = useState(false);

  const handleValueChange = (value: string) => {
    dispatch({
      type: 'updateState',
      payload: {selectedFormat: value as ExportFormat},
    });
  };

  return (
    <div className="mb-3.5">
      <h3
        id="format-selector-label"
        className={clsx(
          'text-xs font-semibold mb-2.5 uppercase tracking-widest',
          'text-black/45 dark:text-white/50'
        )}
      >
        Format
      </h3>
      <RadioGroup
        className="flex flex-col gap-2"
        aria-labelledby="format-selector-label"
        ref={formatOptionsRef}
        value={selectedFormat}
        onValueChange={handleValueChange}
        disabled={isExporting}
        onKeyDown={() => setIsKeyboardNav(true)}
        onPointerDown={() => setIsKeyboardNav(false)}
      >
        {options.map(option => {
          const isSelected = selectedFormat === option.id;
          const isDisabled = option.disabled || isExporting;
          return (
            <label
              key={option.id}
              className={clsx(
                'flex items-start gap-3 py-3 px-3.5 border rounded-xl',
                'cursor-pointer text-left relative',
                'transition duration-150 ease-out',
                'active:scale-[0.97]',
                'has-[[data-disabled]]:opacity-60 has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:transform-none',
                'focus-within:ring-2 focus-within:ring-df-blue focus-within:ring-offset-1',
                !isSelected &&
                  'bg-transparent border-transparent hover:bg-df-surface-muted dark:hover:bg-df-dark-muted',
                isSelected && 'bg-df-blue/5 border-df-blue/15',
                isSelected && 'dark:bg-df-blue/10 dark:border-df-blue/20'
              )}
            >
              <Radio.Root
                value={option.id}
                disabled={isDisabled}
                className="sr-only"
              />
              {/* Radio indicator */}
              <span
                className={clsx(
                  'flex items-center justify-center w-4.5 h-4.5 rounded-full border-2 shrink-0 mt-0.5',
                  'transition-colors duration-150',
                  !isSelected && 'border-black/20 dark:border-white/25',
                  isSelected && 'border-df-blue dark:border-df-blue'
                )}
              >
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full',
                    !isKeyboardNav && 'transition-transform duration-150',
                    isSelected ? 'bg-df-blue scale-100' : 'scale-0'
                  )}
                />
              </span>
              {/* Icon */}
              <span
                className={clsx(
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
                <span
                  className={clsx(
                    'text-sm font-medium',
                    'text-df-ink dark:text-white'
                  )}
                >
                  {option.label}
                </span>
                <span
                  className={clsx('text-xs leading-snug', 'text-muted-soft')}
                >
                  {option.description}
                </span>
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
