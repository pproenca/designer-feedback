export type FeedbackCategory =
  | 'bug'
  | 'suggestion'
  | 'question'
  | 'accessibility';

export type Annotation = {
  id: string;
  x: number;
  y: number;
  comment: string;
  category: FeedbackCategory;
  element: string;
  elementPath: string;
  timestamp: number;

  screenshot?: string;
  screenshotBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selectedText?: string;
  boundingBox?: {x: number; y: number; width: number; height: number};
  nearbyText?: string;
  cssClasses?: string;
  nearbyElements?: string;
  computedStyles?: string;
  fullPath?: string;
  accessibility?: string;
  isMultiSelect?: boolean;
  isFixed?: boolean;
};

export type Settings = {
  enabled: boolean;
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
