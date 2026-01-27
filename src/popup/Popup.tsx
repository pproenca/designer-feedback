import { useMemo, useState, useEffect, useRef } from 'react';
import type { Settings, SiteListMode } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import {
  formatSiteList,
  getHostFromUrl,
  isHttpUrl,
  parseSiteListInput,
} from '@/utils/site-access';
import styles from './styles.module.scss';

export function Popup() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [annotationCount, setAnnotationCount] = useState(0);
  const [siteListText, setSiteListText] = useState('');
  const [savedSiteListText, setSavedSiteListText] = useState('');
  const [siteListStatus, setSiteListStatus] = useState<'idle' | 'dirty' | 'saved'>('idle');
  const saveStatusTimeoutRef = useRef<number | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const canUseCurrentSite = useMemo(
    () => (activeUrl ? isHttpUrl(activeUrl) : false),
    [activeUrl]
  );
  const contentScriptFiles = ['assets/content-loader.js'];
  const contentStyleFiles = ['assets/content.css'];

  const queryActiveTab = () =>
    new Promise<chrome.tabs.Tab | null>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to query tabs:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(tabs[0] ?? null);
      });
    });

  const sendMessageToTab = (tabId: number, message: unknown) =>
    new Promise<{ response: unknown | null; error?: string }>((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ response: null, error: chrome.runtime.lastError.message });
          return;
        }
        resolve({ response });
      });
    });

  const injectContentScript = async (tabId: number) => {
    await new Promise<void>((resolve) => {
      chrome.scripting.insertCSS({ target: { tabId }, files: contentStyleFiles }, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });

    return new Promise<boolean>((resolve) => {
      chrome.scripting.executeScript({ target: { tabId }, files: contentScriptFiles }, () => {
        if (chrome.runtime.lastError) {
          console.debug('Failed to inject content script:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  };

  const ensureContentScript = async (tabId: number) => {
    const ping = await sendMessageToTab(tabId, { type: 'PING' });
    if (!ping.error) return true;
    const injected = await injectContentScript(tabId);
    if (!injected) return false;
    const pingAfter = await sendMessageToTab(tabId, { type: 'PING' });
    return !pingAfter.error;
  };

  const sendMessageToActiveTab = async (message: unknown) => {
    const tab = await queryActiveTab();
    const tabId = tab?.id;
    if (!tabId) return null;
    const ready = await ensureContentScript(tabId);
    if (!ready) return null;
    const { response, error } = await sendMessageToTab(tabId, message);
    if (error) return null;
    return response;
  };

  useEffect(() => {
    // Load settings
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get settings:', chrome.runtime.lastError.message);
        return;
      }
      const nextSettings = result as Settings;
      setSettings(nextSettings);
      const formattedList = formatSiteList(nextSettings.siteList);
      setSiteListText(formattedList);
      setSavedSiteListText(formattedList);
      setSiteListStatus('idle');
    });

    // Load current tab URL
    queryActiveTab().then((tab) => {
      const url = tab?.url ?? null;
      setActiveUrl(url);
      setActiveHost(url ? getHostFromUrl(url) : null);
    });

    // Get current tab's annotation count directly from content script
    sendMessageToActiveTab({ type: 'GET_ANNOTATION_COUNT' }).then((response) => {
      const count = (response as { count?: number } | null)?.count;
      if (count !== undefined) {
        setAnnotationCount(count);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  const markSiteListSaved = (nextText: string) => {
    setSavedSiteListText(nextText);
    setSiteListStatus('saved');
    if (saveStatusTimeoutRef.current) {
      window.clearTimeout(saveStatusTimeoutRef.current);
    }
    saveStatusTimeoutRef.current = window.setTimeout(() => {
      setSiteListStatus('idle');
    }, 1500);
  };

  const handleSiteListChange = (value: string) => {
    setSiteListText(value);
    if (value === savedSiteListText) {
      setSiteListStatus('idle');
    } else {
      setSiteListStatus('dirty');
    }
  };

  const handleToggle = (enabled: boolean) => {
    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save settings:', chrome.runtime.lastError.message);
      }
    });

    // Notify content script
    // Ignore errors - content script may not be loaded on this page
    void sendMessageToActiveTab({ type: 'TOGGLE_TOOLBAR', enabled });
  };

  const handleExport = () => {
    sendMessageToActiveTab({ type: 'TRIGGER_EXPORT' }).finally(() => {
      window.close();
    });
  };

  const handleModeChange = (mode: SiteListMode) => {
    const newSettings = { ...settings, siteListMode: mode };
    setSettings(newSettings);
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update site list mode:', chrome.runtime.lastError.message);
      }
    });
  };

  const handleSaveSiteList = () => {
    const siteList = parseSiteListInput(siteListText);
    const formattedList = formatSiteList(siteList);
    const newSettings = { ...settings, siteList };
    setSettings(newSettings);
    setSiteListText(formattedList);
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update site list:', chrome.runtime.lastError.message);
        setSiteListStatus('dirty');
        return;
      }
      markSiteListSaved(formattedList);
    });
  };

  const handleAddCurrentSite = () => {
    if (!activeHost) return;
    const nextList = parseSiteListInput(`${siteListText}\n${activeHost}`);
    const formattedList = formatSiteList(nextList);
    const newSettings = { ...settings, siteList: nextList };
    setSettings(newSettings);
    setSiteListText(formattedList);
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update site list:', chrome.runtime.lastError.message);
        setSiteListStatus('dirty');
        return;
      }
      markSiteListSaved(formattedList);
    });
  };

  const siteListLabel =
    settings.siteListMode === 'allowlist' ? 'Allowed sites' : 'Blocked sites';

  const siteActionLabel =
    settings.siteListMode === 'allowlist' ? 'Allow this site' : 'Disable on this site';
  const saveButtonLabel =
    siteListStatus === 'saved'
      ? 'Saved'
      : siteListStatus === 'dirty'
        ? 'Save changes'
        : 'Save list';

  return (
    <div className={styles.popup}>
      <div className={styles.header}>
        <h1 className={styles.title}>Designer Feedback</h1>
        <span className={styles.version}>v1.0.0</span>
      </div>

      <div className={styles.section}>
        <label className={styles.toggle}>
          <span className={styles.toggleLabel}>Enable Toolbar</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
          />
          <span className={styles.toggleSwitch} />
        </label>
      </div>

      <div className={styles.section}>
        <div className={styles.stats}>
          <span className={styles.statsLabel}>Annotations on this page</span>
          <span className={styles.statsCount}>{annotationCount}</span>
        </div>
      </div>

      <div className={styles.section}>
        <button
          className={styles.exportButton}
          onClick={handleExport}
          disabled={annotationCount === 0}
          type="button"
        >
          Export Feedback
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Site access</span>
          <span className={styles.sectionMeta}>
            {settings.siteListMode === 'allowlist' ? 'Allowlist' : 'Blocklist'}
          </span>
        </div>

        <div className={styles.modeSwitch}>
          <button
            type="button"
            className={`${styles.modeButton} ${settings.siteListMode === 'blocklist' ? styles.active : ''}`}
            onClick={() => handleModeChange('blocklist')}
            aria-pressed={settings.siteListMode === 'blocklist'}
          >
            All sites
          </button>
          <button
            type="button"
            className={`${styles.modeButton} ${settings.siteListMode === 'allowlist' ? styles.active : ''}`}
            onClick={() => handleModeChange('allowlist')}
            aria-pressed={settings.siteListMode === 'allowlist'}
          >
            Only allowlist
          </button>
        </div>

        <label className={styles.siteListLabel}>
          {siteListLabel}
          <textarea
            className={`${styles.siteList} ${
              siteListStatus === 'dirty'
                ? styles.siteListDirty
                : siteListStatus === 'saved'
                  ? styles.siteListSaved
                  : ''
            }`}
            rows={4}
            value={siteListText}
            onChange={(e) => handleSiteListChange(e.target.value)}
            placeholder="example.com&#10;*.example.com&#10;https://example.com/admin"
          />
        </label>

        <div className={styles.siteActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleAddCurrentSite}
            disabled={!canUseCurrentSite || !activeHost}
          >
            {siteActionLabel}
          </button>
          <button
            type="button"
            className={`${styles.secondaryButton} ${styles.saveButton} ${
              siteListStatus === 'dirty'
                ? styles.saveButtonDirty
                : siteListStatus === 'saved'
                  ? styles.saveButtonSaved
                  : ''
            }`}
            onClick={handleSaveSiteList}
            disabled={siteListStatus !== 'dirty'}
          >
            {saveButtonLabel}
          </button>
        </div>

        <div
          className={`${styles.saveStatus} ${
            siteListStatus === 'dirty'
              ? styles.saveStatusDirty
              : siteListStatus === 'saved'
                ? styles.saveStatusSaved
                : ''
          }`}
          role="status"
          aria-live="polite"
        >
          {siteListStatus === 'dirty' && 'Unsaved changes'}
          {siteListStatus === 'saved' && 'Saved'}
        </div>

        <p className={styles.helperText}>
          One host or URL prefix per line. Supports wildcards like *.example.com.
        </p>
      </div>
    </div>
  );
}
