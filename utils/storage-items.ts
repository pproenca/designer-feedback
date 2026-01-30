/**
 * Typed storage items using WXT's storage.defineItem pattern
 * Provides type-safe storage access with fallback defaults
 */
import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS } from '@/shared/settings';

// =============================================================================
// Session Storage Items (cleared when browser closes)
// =============================================================================

/**
 * Tracks which tabs have activated the toolbar (by origin hash)
 * Key format: tabId -> originHash
 */
export const activatedTabs = storage.defineItem<Record<string, string>>(
  'session:designer-feedback:activated-tabs',
  {
    fallback: {},
  }
);

export const settingsEnabled = storage.defineItem<boolean>('sync:enabled', {
  fallback: DEFAULT_SETTINGS.enabled,
});

export const settingsLightMode = storage.defineItem<boolean>('sync:lightMode', {
  fallback: DEFAULT_SETTINGS.lightMode,
});
