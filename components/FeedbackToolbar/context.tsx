

export type PendingAnnotation = {
  x: number;
  y: number;
  element: string;
  elementPath: string;
  target: HTMLElement;
  rect: DOMRect;
  isFixed: boolean;
  scrollX: number;
  scrollY: number;
};

export type AddMode = 'idle' | 'category' | 'selecting';
