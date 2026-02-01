import {assertDomAvailable} from '@/utils/dom/guards';

const EDGE_SAMPLE_POINTS = [0.1, 0.5, 0.9];
const EDGE_OFFSET_PX = 2;
const MIN_EDGE_HEIGHT_PX = 8;
const MAX_STICKY_HEIGHT_RATIO = 0.4;
const MIN_STICKY_WIDTH_RATIO = 0.6;

type HiddenElementSnapshot = {
  element: HTMLElement;
  visibility: string;
  opacity: string;
  pointerEvents: string;
};

type StickyEdge = 'top' | 'bottom';

export function hideStickyElements(edge: StickyEdge): HiddenElementSnapshot[] {
  assertDomAvailable('hideStickyElements');
  const elements = collectStickyElements(edge);
  const hidden: HiddenElementSnapshot[] = [];

  elements.forEach(element => {
    hidden.push({
      element,
      visibility: element.style.visibility,
      opacity: element.style.opacity,
      pointerEvents: element.style.pointerEvents,
    });

    element.style.visibility = 'hidden';
    element.style.opacity = '0';
    element.style.pointerEvents = 'none';
  });

  return hidden;
}

export function restoreHiddenElements(hidden: HiddenElementSnapshot[]): void {
  hidden.forEach(({element, visibility, opacity, pointerEvents}) => {
    element.style.visibility = visibility;
    element.style.opacity = opacity;
    element.style.pointerEvents = pointerEvents;
  });
}

function collectStickyElements(edge: StickyEdge): Set<HTMLElement> {
  const root = document.getElementById('designer-feedback-root');
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const y =
    edge === 'top'
      ? EDGE_OFFSET_PX
      : Math.max(EDGE_OFFSET_PX, viewportHeight - EDGE_OFFSET_PX);
  const elements = new Set<HTMLElement>();

  EDGE_SAMPLE_POINTS.forEach(ratio => {
    const x = Math.min(
      viewportWidth - EDGE_OFFSET_PX,
      Math.max(EDGE_OFFSET_PX, Math.round(viewportWidth * ratio))
    );
    const stack = document.elementsFromPoint(x, y) as HTMLElement[];
    stack.forEach(candidate => {
      const sticky = findStickyAncestor(
        candidate,
        edge,
        viewportWidth,
        viewportHeight,
        root
      );
      if (sticky) {
        elements.add(sticky);
      }
    });
  });

  return elements;
}

function findStickyAncestor(
  start: HTMLElement,
  edge: StickyEdge,
  viewportWidth: number,
  viewportHeight: number,
  root: HTMLElement | null
): HTMLElement | null {
  let node: HTMLElement | null = start;

  while (node && node !== document.body && node !== document.documentElement) {
    if (root && root.contains(node)) return null;

    const style = window.getComputedStyle(node);
    if (style.position === 'fixed' || style.position === 'sticky') {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > MIN_EDGE_HEIGHT_PX) {
        const wideEnough = rect.width >= viewportWidth * MIN_STICKY_WIDTH_RATIO;
        const shortEnough =
          rect.height <= viewportHeight * MAX_STICKY_HEIGHT_RATIO;
        if (wideEnough && shortEnough) {
          const nearTop = rect.top <= EDGE_OFFSET_PX;
          const nearBottom = rect.bottom >= viewportHeight - EDGE_OFFSET_PX;
          if (
            (edge === 'top' && nearTop) ||
            (edge === 'bottom' && nearBottom)
          ) {
            return node;
          }
        }
      }
    }

    node = node.parentElement;
  }

  return null;
}
