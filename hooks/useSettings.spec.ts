import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// Mock sendMessage module
vi.mock('@/utils/messaging', () => ({
  sendMessage: vi.fn(),
}));

import { useSettings } from './useSettings';
import { sendMessage } from '@/utils/messaging';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import type { Settings } from '@/types';

const mockSendMessage = vi.mocked(sendMessage);

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeBrowser.reset();
    // Default mock implementation returns settings
    mockSendMessage.mockResolvedValue({
      type: 'SETTINGS_RESPONSE',
      settings: DEFAULT_SETTINGS,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('loading settings', () => {
    it('should use sendMessage to get settings on mount', async () => {
      const customSettings: Settings = { enabled: false, lightMode: false };
      mockSendMessage.mockResolvedValueOnce({
        type: 'SETTINGS_RESPONSE',
        settings: customSettings,
      });

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_SETTINGS' });
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
        expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_SETTINGS' });
      });

      // Should keep default settings on error
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get settings:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('updating settings', () => {
    it('should use sendMessage to save settings when updateSettings is called', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for initial load
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_SETTINGS' });
      });

      // Clear mock to track new calls
      mockSendMessage.mockClear();
      mockSendMessage.mockResolvedValueOnce({
        type: 'SETTINGS_RESPONSE',
        settings: { ...DEFAULT_SETTINGS, lightMode: false },
      });

      // Update settings
      act(() => {
        result.current.updateSettings({ lightMode: false });
      });

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: 'SAVE_SETTINGS',
          settings: { ...DEFAULT_SETTINGS, lightMode: false },
        });
      });

      expect(result.current.settings.lightMode).toBe(false);
    });

    it('should not call sendMessage when updateSettings is called with empty object', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for initial load
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_SETTINGS' });
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
    it('should still listen to browser.storage.onChanged events', async () => {
      const { result } = renderHook(() => useSettings());

      // Wait for initial load
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });

      // Simulate storage change from another context
      act(() => {
        fakeBrowser.storage.onChanged.trigger(
          { lightMode: { newValue: false, oldValue: true } },
          'sync'
        );
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
        fakeBrowser.storage.onChanged.trigger(
          { lightMode: { newValue: false, oldValue: true } },
          'local'
        );
      });

      // Should still be true (unchanged)
      expect(result.current.settings.lightMode).toBe(true);
    });
  });
});
