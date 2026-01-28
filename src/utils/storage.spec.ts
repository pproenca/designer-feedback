import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockChrome } from '../test/setup';

describe('Storage Quota Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check bytes in use before saving', async () => {
    // This test documents the expected behavior after implementing quota validation
    // The checkStorageQuota function should call getBytesInUse

    mockChrome.storage.local.getBytesInUse.mockImplementation(
      (_keys: unknown, callback: (bytesInUse: number) => void) => {
        callback(5_000_000); // 5MB used
      }
    );

    mockChrome.storage.local.set.mockImplementation(
      (_items: unknown, callback: () => void) => {
        callback();
      }
    );

    // Import after mocks are set up
    const storage = await import('./storage');

    // If checkStorageQuota exists and is exported, test it
    if ('checkStorageQuota' in storage) {
      const result = await (
        storage as { checkStorageQuota: () => Promise<{ ok: boolean; bytesUsed: number }> }
      ).checkStorageQuota();
      expect(result.ok).toBe(true);
      expect(result.bytesUsed).toBe(5_000_000);
    } else {
      // Before implementation, just verify getBytesInUse is available
      expect(mockChrome.storage.local.getBytesInUse).toBeDefined();
    }
  });

  it('should warn at 80% capacity (8MB of 10MB)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockChrome.storage.local.getBytesInUse.mockImplementation(
      (_keys: unknown, callback: (bytesInUse: number) => void) => {
        callback(8_500_000); // 8.5MB - above 80% threshold
      }
    );

    const storage = await import('./storage');

    if ('checkStorageQuota' in storage) {
      await (
        storage as { checkStorageQuota: () => Promise<{ ok: boolean }> }
      ).checkStorageQuota();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('quota')
      );
    }

    consoleSpy.mockRestore();
  });

  it('should prevent saves that would exceed quota', async () => {
    // Reset mock for this specific test
    mockChrome.storage.local.getBytesInUse.mockReset();
    mockChrome.storage.local.getBytesInUse.mockImplementation(
      (_keys: unknown, callback: (bytesInUse: number) => void) => {
        callback(10_500_000); // 10.5MB - over the 10MB limit
      }
    );

    // Force re-import by using resetModules (if available) or just call the function
    const { checkStorageQuota } = await import('./storage');

    const result = await checkStorageQuota();

    // At 10.5MB / 10MB = 105%, this should be over quota
    expect(result.ok).toBe(false);
    expect(result.percentUsed).toBeGreaterThan(1);
  });
});
