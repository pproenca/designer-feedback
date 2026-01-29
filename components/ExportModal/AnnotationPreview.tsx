import type { Annotation } from '@/types';
import { getCategoryConfig } from '@/shared/categories';
import { classNames } from '@/utils/classNames';

interface AnnotationPreviewProps {
  annotations: Annotation[];
  maxItems?: number;
}

export function AnnotationPreview({ annotations, maxItems = 5 }: AnnotationPreviewProps) {
  const visibleAnnotations = annotations.slice(0, maxItems);
  const remainingCount = annotations.length - maxItems;

  return (
    <div className="mt-2 mb-3.5 p-0 bg-transparent rounded-none border-none">
      <h3 className={classNames('text-xs font-semibold mb-2 uppercase tracking-widest', 'text-black/45 dark:text-white/50')}>
        Preview
      </h3>
      <div className="flex flex-col gap-1.5">
        {visibleAnnotations.map((annotation, index) => {
          const config = getCategoryConfig(annotation.category);
          return (
            <div
              key={annotation.id}
              className={classNames(
                'flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg bg-transparent border-none',
                'transition-colors duration-150 ease-out',
                'hover:bg-df-surface-muted dark:hover:bg-df-dark-muted'
              )}
            >
              <span
                className={classNames(
                  'flex items-center justify-center w-5 h-5 rounded-full text-2xs font-bold shrink-0',
                  'shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.08)]',
                  config.tw.bg,
                  annotation.category === 'question' ? 'text-black/80' : 'text-white'
                )}
              >
                {index + 1}
              </span>
              <span
                className={classNames(
                  'whitespace-nowrap overflow-hidden text-ellipsis max-w-30',
                  'text-black/75 dark:text-white/85'
                )}
              >
                {annotation.element}
              </span>
              <span
                className={classNames(
                  'whitespace-nowrap overflow-hidden text-ellipsis flex-1',
                  'text-black/45 dark:text-white/55'
                )}
              >
                {annotation.comment}
              </span>
            </div>
          );
        })}
        {remainingCount > 0 && (
          <div className={classNames('text-xs italic pt-1', 'text-black/35 dark:text-white/45')}>
            +{remainingCount} more annotations
          </div>
        )}
      </div>
    </div>
  );
}
