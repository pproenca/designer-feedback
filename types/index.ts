export type FeedbackCategory =
  | 'bug'
  | 'suggestion'
  | 'question'
  | 'accessibility';

export type Annotation = {
  /** Core fields — always present after creation */
  id: string;
  x: number;
  y: number;
  comment: string;
  category: FeedbackCategory;
  element: string;
  elementPath: string;
  timestamp: number;

  /** Position metadata — set at creation based on target element */
  boundingBox?: {x: number; y: number; width: number; height: number};
  isFixed?: boolean;

  /** Element metadata — populated by enrichment after annotation creation */
  selectedText?: string;
  nearbyText?: string;
  cssClasses?: string;
  nearbyElements?: string;
  computedStyles?: string;
  fullPath?: string;
  accessibility?: string;
  isMultiSelect?: boolean;

  /** Export-time fields — populated during snapshot export only */
  screenshot?: string;
  screenshotBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type Settings = {
  lightMode: boolean;
};

export type ExportFormat = 'image-notes' | 'snapshot';

export type PendingCaptureFormat = Extract<ExportFormat, 'snapshot'>;

export type PendingCaptureSource = 'context-menu' | 'active-tab-retry';

export type PendingCaptureRequest = {
  requestId: string;
  format: PendingCaptureFormat;
  createdAt: number;
  source?: PendingCaptureSource;
};
