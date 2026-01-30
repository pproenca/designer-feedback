import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// Mock backgroundMessenger
const mockSendMessage = vi.fn();
vi.mock('@/utils/messaging', () => ({
  backgroundMessenger: {
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  },
}));

import { useSettings } from './useSettings';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Settings } from '@/types';

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeBrowser.reset();
    // Default mock implementation returns settings
    mockSendMessage.mockResolvedValue({
      settings: DEFAULT_SETTINGS,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading settings', () => {
    it('should use backgroundMessenger to get settings on mount', async () => {
      const customSettings: Settings = { enabled: false, lightMode: false };
      mockSendMessage.mockResolvedValueOnce({
        settings: customSettings,
      });

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('getSettings', undefined);
      });

      await waitFor(() => {
        expect(result.current.settings).toEqual(customSettings);
      });
    });

    it('should use default settings on message error', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Failed to get settings'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('getSettings', undefined);
      });

      // Should keep default settings on error
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get settings:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updating settings', () => {
    it('should use backgroundMessenger to save settings when updateSettings is called', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for initial load
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('getSettings', undefined);
      });

      // Clear mock to track new calls
      mockSendMessage.mockClear();
      mockSendMessage.mockResolvedValueOnce({
        settings: { ...DEFAULT_SETTINGS, lightMode: false },
      });

      // Update settings
      act(() => {
        result.current.updateSettings({ lightMode: false });
      });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('saveSettings', {
          ...DEFAULT_SETTINGS,
          lightMode: false,
        });
      });

      expect(result.current.settings.lightMode).toBe(false);
    });

    it('should not call backgroundMessenger when updateSettings is called with empty object', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for initial load
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('getSettings', undefined);
      });

      // Clear mock to track new calls
      mockSendMessage.mockClear();

      // Update with empty object
      act(() => {
        result.current.updateSettings({});
      });

      // Should not have called sendMessage
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('storage change listener', () => {
    it('should still listen to sync storage changes', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for initial load
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      // Simulate storage change from another context
      act(() => {
        fakeBrowser.storage.sync.onChanged.trigger({
          lightMode: { newValue: false, oldValue: true },
        });
      });

      expect(result.current.settings.lightMode).toBe(false);
    });

    it('should ignore storage changes from non-sync areas', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for initial load
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      // Simulate storage change from local area (should be ignored)
      act(() => {
        fakeBrowser.storage.local.onChanged.trigger({
          lightMode: { newValue: false, oldValue: true },
        });
      });

      // Should still be true (unchanged)
      expect(result.current.settings.lightMode).toBe(true);
    });
  });
});
