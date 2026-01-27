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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to query tabs:', chrome.runtime.lastError.message);
        return;
      }
      const url = tabs[0]?.url ?? null;
      setActiveUrl(url);
      setActiveHost(url ? getHostFromUrl(url) : null);
    });

    // Get current tab's annotation count directly from content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to query tabs:', chrome.runtime.lastError.message);
        return;
      }
      const tabId = tabs[0]?.id;
      if (tabId) {
        chrome.tabs.sendMessage(
          tabId,
          { type: 'GET_ANNOTATION_COUNT' },
          (response) => {
            if (chrome.runtime.lastError) {
              // Content script may not be loaded on this page
              console.debug('Could not get annotation count:', chrome.runtime.lastError.message);
              return;
            }
            if (response?.count !== undefined) {
              setAnnotationCount(response.count);
            }
          }
        );
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
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to query tabs:', chrome.runtime.lastError.message);
        return;
      }
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_TOOLBAR',
          enabled,
        }, () => {
          // Ignore errors - content script may not be loaded
          void chrome.runtime.lastError;
        });
      }
    });
  };

  const handleExport = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to query tabs:', chrome.runtime.lastError.message);
        return;
      }
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_EXPORT' }, () => {
          // Ignore errors - content script may not be loaded
          void chrome.runtime.lastError;
        });
        window.close();
      }
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
