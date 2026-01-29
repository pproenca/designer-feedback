// =============================================================================
// Chrome Offscreen API Types
// =============================================================================
// Type declarations for Chrome's Offscreen Document API (MV3 only).
// These APIs are not part of the cross-browser WebExtension API polyfill.

declare namespace chrome {
  namespace offscreen {
    type Reason =
      | 'TESTING'
      | 'AUDIO_PLAYBACK'
      | 'IFRAME_SCRIPTING'
      | 'DOM_SCRAPING'
      | 'BLOBS'
      | 'DOM_PARSER'
      | 'USER_MEDIA'
      | 'DISPLAY_MEDIA'
      | 'WEB_RTC'
      | 'CLIPBOARD'
      | 'LOCAL_STORAGE'
      | 'WORKERS'
      | 'BATTERY_STATUS'
      | 'MATCH_MEDIA'
      | 'GEOLOCATION';

    interface CreateParameters {
      url: string;
      reasons: Reason[];
      justification: string;
    }

    function createDocument(parameters: CreateParameters): Promise<void>;
    function closeDocument(): Promise<void>;
    function hasDocument(): Promise<boolean>;
  }

  namespace runtime {
    interface ContextFilter {
      contextTypes?: Array<'TAB' | 'POPUP' | 'BACKGROUND' | 'OFFSCREEN_DOCUMENT' | 'SIDE_PANEL'>;
      contextIds?: string[];
      tabIds?: number[];
      windowIds?: number[];
      documentIds?: string[];
      frameIds?: number[];
      documentUrls?: string[];
      documentOrigins?: string[];
      incognito?: boolean;
    }

    interface ExtensionContext {
      contextType: string;
      contextId: string;
      tabId?: number;
      windowId?: number;
      documentId?: string;
      frameId?: number;
      documentUrl?: string;
      documentOrigin?: string;
      incognito: boolean;
    }

    interface MessageSender {
      tab?: { id?: number; url?: string; windowId?: number };
      frameId?: number;
      id?: string;
      url?: string;
      origin?: string;
    }

    interface MessageEvent {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      ): void;
    }

    function getContexts(filter: ContextFilter): Promise<ExtensionContext[]>;
    const onMessage: MessageEvent;
  }
}
