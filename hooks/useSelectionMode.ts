import {useEffect} from 'react';
import {
  identifyElement,
  hasFixedPositioning,
} from '@/utils/dom/element-identification';
import type {PendingAnnotation} from '@/components/FeedbackToolbar/context';

export function useSelectionMode(
  isActive: boolean,
  onElementSelected: (data: PendingAnnotation) => void
) {
  useEffect(() => {
    if (!isActive) return undefined;

    const handleAddModeClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (
        target.closest('[data-annotation-popup]') ||
        target.closest('[data-toolbar]')
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const rect = target.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const scrollLeft = window.scrollX;
      const isFixed = hasFixedPositioning(target);
      const clickX = e.clientX;
      const clickY = e.clientY;

      const {name, path} = identifyElement(target);

      onElementSelected({
        x: isFixed ? clickX : clickX + scrollLeft,
        y: isFixed ? clickY : clickY + scrollTop,
        element: name,
        elementPath: path,
        target,
        rect,
        isFixed,
        scrollX: scrollLeft,
        scrollY: scrollTop,
      });
    };

    document.addEventListener('click', handleAddModeClick, true);
    return () =>
      document.removeEventListener('click', handleAddModeClick, true);
  }, [isActive, onElementSelected]);

  useEffect(() => {
    if (isActive) {
      document.body.classList.add('designer-feedback-add-mode');
    } else {
      document.body.classList.remove('designer-feedback-add-mode');
    }
    return () => document.body.classList.remove('designer-feedback-add-mode');
  }, [isActive]);
}
