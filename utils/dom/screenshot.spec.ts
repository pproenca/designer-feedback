import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  ActiveTabRequiredError,
  CaptureRateLimitedError,
  captureScreenshot,
} from './screenshot';
import {backgroundMessenger} from '@/utils/messaging';

vi.mock('@/utils/messaging', () => ({
  backgroundMessenger: {
    sendMessage: vi.fn(),
  },
  withTimeout: <T>(promise: Promise<T>) => promise,
}));

describe('captureScreenshot error code handling', () => {
  const mockedSendMessage = vi.mocked(backgroundMessenger.sendMessage);

  beforeEach(() => {
    mockedSendMessage.mockReset();
  });

  it('throws ActiveTabRequiredError for activeTab-required code', async () => {
    mockedSendMessage.mockResolvedValue({
      data: '',
      error: 'activeTab permission required',
      errorCode: 'activeTab-required',
    });

    await expect(captureScreenshot()).rejects.toBeInstanceOf(
      ActiveTabRequiredError
    );
  });

  it('throws CaptureRateLimitedError for capture-rate-limited code', async () => {
    mockedSendMessage.mockResolvedValue({
      data: '',
      error: 'MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND',
      errorCode: 'capture-rate-limited',
    });

    await expect(captureScreenshot()).rejects.toBeInstanceOf(
      CaptureRateLimitedError
    );
  });
});
