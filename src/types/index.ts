// =============================================================================
// Shared Types
// =============================================================================

export type FeedbackCategory = 'bug' | 'suggestion' | 'question' | 'accessibility';

export type Annotation = {
  id: string;
  x: number; // px from left of document (absolute) OR viewport (if isFixed)
  y: number; // px from top of document (absolute) OR viewport (if isFixed)
  comment: string;
  category: FeedbackCategory;
  element: string;
  elementPath: string;
  timestamp: number;
  // Legacy fields - kept for backwards compatibility with existing annotations
  screenshot?: string; // Base64 data URL (no longer captured)
  screenshotBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selectedText?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
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

export type FeedbackExport = {
  version: string;
  exportedAt: string;
  page: {
    url: string;
    title: string;
    viewport: {
      width: number;
      height: number;
    };
  };
  annotations: Annotation[];
  screenshots?: Record<string, string>; // Legacy field, no longer used
};

export type ExportFormat = 'html' | 'image-notes';

// Message types for content <-> background communication
export type MessageType =
  | { type: 'CAPTURE_SCREENSHOT' }
  | { type: 'SCREENSHOT_CAPTURED'; data: string }
  | { type: 'GET_SETTINGS' }
  | { type: 'SETTINGS_RESPONSE'; settings: Settings }
  | { type: 'SAVE_SETTINGS'; settings: Settings }
  | { type: 'GET_ANNOTATION_COUNT'; url: string }
  | { type: 'ANNOTATION_COUNT_RESPONSE'; count: number }
  | { type: 'UPDATE_BADGE'; count: number };
