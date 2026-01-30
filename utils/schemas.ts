// =============================================================================
// Zod Schemas for Message Validation
// =============================================================================

import { z } from 'zod';

// =============================================================================
// Settings Schema
// =============================================================================

export const SettingsSchema = z.object({
  enabled: z.boolean(),
  lightMode: z.boolean(),
});

// =============================================================================
// Message Schemas
// =============================================================================

const CaptureScreenshotMessage = z.object({
  type: z.literal('CAPTURE_SCREENSHOT'),
});

const ScreenshotCapturedMessage = z.object({
  type: z.literal('SCREENSHOT_CAPTURED'),
  data: z.string(),
  error: z.string().optional(),
});

const DownloadFileMessage = z.object({
  type: z.literal('DOWNLOAD_FILE'),
  filename: z.string(),
  dataUrl: z.string(),
});

const OffscreenDownloadMessage = z.object({
  type: z.literal('OFFSCREEN_DOWNLOAD'),
  dataUrl: z.string(),
});

const GetSettingsMessage = z.object({
  type: z.literal('GET_SETTINGS'),
});

const SettingsResponseMessage = z.object({
  type: z.literal('SETTINGS_RESPONSE'),
  settings: SettingsSchema,
  error: z.string().optional(),
});

const SaveSettingsMessage = z.object({
  type: z.literal('SAVE_SETTINGS'),
  settings: SettingsSchema,
});

const GetAnnotationCountMessage = z.object({
  type: z.literal('GET_ANNOTATION_COUNT'),
  url: z.string().optional(),
});

const AnnotationCountResponseMessage = z.object({
  type: z.literal('ANNOTATION_COUNT_RESPONSE'),
  count: z.number(),
});

const UpdateBadgeMessage = z.object({
  type: z.literal('UPDATE_BADGE'),
  count: z.number(),
});

const TriggerExportMessage = z.object({
  type: z.literal('TRIGGER_EXPORT'),
});

const ToggleToolbarMessage = z.object({
  type: z.literal('TOGGLE_TOOLBAR'),
  enabled: z.boolean(),
});

const ShowToolbarMessage = z.object({
  type: z.literal('SHOW_TOOLBAR'),
});

// =============================================================================
// Discriminated Union of All Messages
// =============================================================================

export const MessageSchema = z.discriminatedUnion('type', [
  CaptureScreenshotMessage,
  ScreenshotCapturedMessage,
  DownloadFileMessage,
  OffscreenDownloadMessage,
  GetSettingsMessage,
  SettingsResponseMessage,
  SaveSettingsMessage,
  GetAnnotationCountMessage,
  AnnotationCountResponseMessage,
  UpdateBadgeMessage,
  TriggerExportMessage,
  ToggleToolbarMessage,
  ShowToolbarMessage,
]);

// =============================================================================
// Type Inference from Schemas
// =============================================================================

export type Settings = z.infer<typeof SettingsSchema>;
export type Message = z.infer<typeof MessageSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Safely parse a message, returning the parsed result or null if invalid.
 * Logs validation errors for debugging.
 */
export function parseMessage(message: unknown): Message | null {
  const result = MessageSchema.safeParse(message);
  if (!result.success) {
    console.warn('[MessageValidation] Invalid message:', result.error.issues);
    return null;
  }
  return result.data;
}

/**
 * Parse a message and throw if invalid (for strict validation contexts).
 */
export function parseMessageStrict(message: unknown): Message {
  return MessageSchema.parse(message);
}

/**
 * Type guard to check if a message is of a specific type.
 */
export function isMessageType<T extends Message['type']>(
  message: Message | null,
  type: T
): message is Extract<Message, { type: T }> {
  return message?.type === type;
}
