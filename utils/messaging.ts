import type {
  PendingCaptureFormat,
  PendingCaptureSource,
  Settings,
} from '@/types';

export type CaptureScreenshotErrorCode =
  | 'activeTab-required'
  | 'capture-rate-limited';
export type CaptureScreenshotResponse = {
  data: string;
  error?: string;
  errorCode?: CaptureScreenshotErrorCode;
};

export type ResumeExportRequest = {
  requestId: string;
  format: PendingCaptureFormat;
  source: PendingCaptureSource;
};

export type ResumeExportResponse = {
  accepted: boolean;
  requestId: string;
  reason?: string;
};

interface BackgroundProtocolMap {
  captureScreenshot(): CaptureScreenshotResponse;
  downloadFile(params: {filename: string; dataUrl: string}): {
    ok: boolean;
    error?: string;
  };
  getSettings(): {settings: Settings; error?: string};
  saveSettings(settings: Settings): {settings: Settings; error?: string};
  updateBadge(count: number): void;
}

interface ContentProtocolMap {
  getAnnotationCount(url?: string): {count: number};
  pingToolbar(): {ready: true};
  getToolbarStatus(): {mounted: boolean};
  showToolbar(): {mounted: boolean};
  triggerExport(): void;
  toggleToolbar(enabled: boolean): {mounted: boolean};
  resumeExport(params: ResumeExportRequest): ResumeExportResponse;
}

type MaybePromise<T> = T | Promise<T>;
type MessageChannel = 'background' | 'content';

type MessageData<T extends (...args: unknown[]) => unknown> = Parameters<T>[0];
type MessageResult<T extends (...args: unknown[]) => unknown> = Awaited<
  ReturnType<T>
>;

type RuntimeSender = {
  id?: string;
  tab?: {
    id?: number;
    windowId?: number;
  };
};

type Envelope = {
  dfChannel: MessageChannel;
  dfType: string;
  dfData: unknown;
};

type EnvelopeResponse = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

interface RuntimeLike {
  runtime: {
    sendMessage: (...args: unknown[]) => unknown;
    onMessage: {
      addListener(
        listener: (
          message: unknown,
          sender: RuntimeSender,
          sendResponse: (response: EnvelopeResponse) => void
        ) => boolean | void
      ): void;
      removeListener(
        listener: (
          message: unknown,
          sender: RuntimeSender,
          sendResponse: (response: EnvelopeResponse) => void
        ) => boolean | void
      ): void;
    };
    lastError?: {message?: string};
  };
  tabs?: {
    sendMessage: (...args: unknown[]) => unknown;
  };
}

function getRuntime(): {api: RuntimeLike; promiseApi: boolean} {
  const runtime = globalThis as typeof globalThis & {
    browser?: RuntimeLike;
    chrome?: RuntimeLike;
  };

  if (runtime.browser?.runtime?.sendMessage) {
    return {api: runtime.browser, promiseApi: true};
  }

  if (runtime.chrome?.runtime?.sendMessage) {
    return {api: runtime.chrome, promiseApi: false};
  }

  throw new Error('Browser runtime messaging API is unavailable');
}

function toErrorString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isEnvelope(message: unknown): message is Envelope {
  if (!message || typeof message !== 'object') {
    return false;
  }
  const candidate = message as Partial<Envelope>;
  return (
    (candidate.dfChannel === 'background' ||
      candidate.dfChannel === 'content') &&
    typeof candidate.dfType === 'string'
  );
}

function callRuntimeMessage(
  runtime: ReturnType<typeof getRuntime>,
  message: Envelope,
  tabId?: number
): Promise<EnvelopeResponse> {
  const {api, promiseApi} = runtime;

  if (promiseApi) {
    if (tabId !== undefined) {
      if (!api.tabs?.sendMessage) {
        return Promise.reject(
          new Error('tabs.sendMessage is unavailable in this context')
        );
      }
      return Promise.resolve(
        api.tabs.sendMessage(tabId, message) as Promise<EnvelopeResponse>
      );
    }
    return Promise.resolve(
      api.runtime.sendMessage(message) as Promise<EnvelopeResponse>
    );
  }

  return new Promise((resolve, reject) => {
    const callback = (response: EnvelopeResponse) => {
      const lastError = api.runtime.lastError;
      if (lastError?.message) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response);
    };

    if (tabId !== undefined) {
      if (!api.tabs?.sendMessage) {
        reject(new Error('tabs.sendMessage is unavailable in this context'));
        return;
      }
      api.tabs.sendMessage(tabId, message, callback);
      return;
    }

    api.runtime.sendMessage(message, callback);
  });
}

function createMessenger<TProtocol extends object>(channel: MessageChannel) {
  type MessageType = keyof TProtocol & string;
  type ProtocolHandler<T extends MessageType> = TProtocol[T] extends (
    ...args: infer TArgs
  ) => infer TResult
    ? (...args: TArgs) => TResult
    : never;
  type Handler<T extends MessageType> = (payload: {
    data: MessageData<ProtocolHandler<T>>;
    sender: RuntimeSender;
  }) => MaybePromise<MessageResult<ProtocolHandler<T>>>;

  const handlers = new Map<MessageType, Handler<MessageType>>();
  let rootListener:
    | ((
        message: unknown,
        sender: RuntimeSender,
        sendResponse: (response: EnvelopeResponse) => void
      ) => boolean | void)
    | null = null;

  function ensureListener(): void {
    if (rootListener) {
      return;
    }

    const {api} = getRuntime();
    rootListener = (message, sender, sendResponse) => {
      if (!isEnvelope(message) || message.dfChannel !== channel) {
        return;
      }

      const handler = handlers.get(message.dfType as MessageType);
      if (!handler) {
        sendResponse({
          ok: false,
          error: `No handler registered for "${message.dfType}"`,
        });
        return true;
      }

      Promise.resolve(
        handler({
          data: message.dfData as MessageData<ProtocolHandler<MessageType>>,
          sender,
        })
      )
        .then(result => {
          sendResponse({ok: true, data: result});
        })
        .catch(error => {
          sendResponse({
            ok: false,
            error: toErrorString(error),
          });
        });

      return true;
    };

    api.runtime.onMessage.addListener(rootListener);
  }

  function maybeRemoveListener(): void {
    if (!rootListener || handlers.size > 0) {
      return;
    }
    try {
      const {api} = getRuntime();
      api.runtime.onMessage.removeListener(rootListener);
    } catch {
      // Ignore cleanup failures when runtime context is unavailable.
    }
    rootListener = null;
  }

  return {
    async sendMessage<T extends MessageType>(
      type: T,
      data: MessageData<ProtocolHandler<T>>,
      tabId?: number
    ): Promise<MessageResult<ProtocolHandler<T>>> {
      const runtime = getRuntime();
      const envelope: Envelope = {
        dfChannel: channel,
        dfType: type,
        dfData: data,
      };

      const response = await callRuntimeMessage(runtime, envelope, tabId);
      if (!response?.ok) {
        throw new Error(response?.error ?? 'Unknown messaging error');
      }
      return response.data as MessageResult<ProtocolHandler<T>>;
    },

    onMessage<T extends MessageType>(type: T, handler: Handler<T>) {
      ensureListener();
      handlers.set(type, handler as Handler<MessageType>);
      return () => {
        handlers.delete(type);
        maybeRemoveListener();
      };
    },

    removeAllListeners() {
      handlers.clear();
      maybeRemoveListener();
    },
  };
}

export const backgroundMessenger =
  createMessenger<BackgroundProtocolMap>('background');

export const contentMessenger = createMessenger<ContentProtocolMap>('content');

const DEFAULT_TIMEOUT_MS = 30000;

export async function withTimeout<T>(
  promise: Promise<T>,
  ms = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(new Error('Message timeout: service worker did not respond')),
      ms
    );
  });
  return Promise.race([promise, timeoutPromise]);
}
