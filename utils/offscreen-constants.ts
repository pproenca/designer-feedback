/**
 * Constants for offscreen document messaging and lifecycle management
 * Provides centralized constants for message routing between service worker and offscreen document
 */

/** Path to the offscreen document HTML file */
export const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';

/**
 * Message target for routing messages to the correct context
 * Used to filter messages in listeners to avoid processing irrelevant messages
 */
export const MESSAGE_TARGET = {
  OFFSCREEN: 'offscreen',
  BACKGROUND: 'background',
  CONTENT: 'content',
} as const;

export type MessageTarget = (typeof MESSAGE_TARGET)[keyof typeof MESSAGE_TARGET];

/**
 * Offscreen document reasons for createDocument API
 * See: https://developer.chrome.com/docs/extensions/reference/api/offscreen#type-Reason
 */
export const OFFSCREEN_REASON = {
  /** For handling blob URLs and data URL conversions */
  BLOBS: 'BLOBS',
} as const;

/**
 * Message types specific to offscreen document operations
 */
export const OFFSCREEN_MESSAGE_TYPE = {
  /** Download a file via the offscreen document */
  DOWNLOAD: 'OFFSCREEN_DOWNLOAD',
} as const;
