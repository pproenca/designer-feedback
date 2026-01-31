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

export type ExportFormat = 'image-notes' | 'snapshot';
