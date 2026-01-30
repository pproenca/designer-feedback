/**
 * Typed storage items using WXT's storage.defineItem pattern
 * Provides type-safe storage access with fallback defaults
 */
import { storage } from 'wxt/utils/storage';

// =============================================================================
// Session Storage Items (cleared when browser closes)
// =============================================================================

/**
 * Tracks which tabs have activated the toolbar (by origin hash)
 * Key format: tabId -> originHash
 */
export const activatedTabs = storage.defineItem<Record<string, string>>(
  'session:activated-tabs',
  {
    fallback: {},
  }
);

// Note: User settings are stored using raw browser.storage.sync with individual keys
// (enabled, lightMode) to maintain backward compatibility with existing user data.
// See hooks/useSettings.ts and entrypoints/background.ts for the settings pattern.
