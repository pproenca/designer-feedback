import { useMemo, useState, useEffect, useRef } from 'react';
import type { Settings, SiteListMode } from '@/types';
import { DEFAULT_SETTINGS } from '@/shared/settings';
import {
  formatSiteList,
  getHostFromUrl,
  isHttpUrl,
  parseSiteListInput,
  normalizeSiteList,
  isUrlAllowed,
} from '@/utils/site-access';
import { getOriginPattern, siteListToOriginPatterns } from '@/utils/permissions';
import styles from './styles.module.scss';

const CONTENT_SCRIPT_FILE = 'assets/content-loader.js';

export function Popup() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [annotationCount, setAnnotationCount] = useState(0);
  const [siteListText, setSiteListText] = useState('');
  const [savedSiteListText, setSavedSiteListText] = useState('');
  const [siteListStatus, setSiteListStatus] = useState<'idle' | 'dirty' | 'saved'>('idle');
  const saveStatusTimeoutRef = useRef<number | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const [hasSitePermission, setHasSitePermission] = useState(false);
  const [hasAllSitesPermission, setHasAllSitesPermission] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const canUseCurrentSite = useMemo(
    () => (activeUrl ? isHttpUrl(activeUrl) : false),
    [activeUrl]
  );
  const isCurrentSiteAllowed = useMemo(
    () => (activeUrl ? isUrlAllowed(activeUrl, settings) : false),
    [activeUrl, settings]
  );

  const getActiveTab = () =>
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

  const refreshSitePermission = (url: string | null) => {
    const originPattern = url ? getOriginPattern(url) : null;
    if (!originPattern) {
      setHasSitePermission(false);
      return;
    }
    chrome.permissions.contains({ origins: [originPattern] }, (granted) => {
      if (chrome.runtime.lastError) {
        setHasSitePermission(false);
        return;
      }
      setHasSitePermission(Boolean(granted));
    });
  };

  const refreshAllSitesPermission = () => {
    chrome.permissions.contains(
      { origins: ['http://*/*', 'https://*/*'] },
      (granted) => {
        if (chrome.runtime.lastError) {
          setHasAllSitesPermission(false);
          return;
        }
        setHasAllSitesPermission(Boolean(granted));
      }
    );
  };

  const requestPermissions = (origins: string[]) =>
    new Promise<boolean>((resolve) => {
      if (origins.length === 0) {
        resolve(false);
        return;
      }
      chrome.permissions.request({ origins }, (granted) => {
        if (chrome.runtime.lastError) {
          console.error('Permission request failed:', chrome.runtime.lastError.message);
          resolve(false);
          return;
        }
        resolve(Boolean(granted));
      });
    });

  const markInjectionIfNeeded = (tabId: number) =>
    new Promise<boolean>((resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          func: () => {
            const windowAny = window as Window & {
              __designerFeedbackInjected?: boolean;
              __designerFeedbackLoaderInjected?: boolean;
            };
            if (
              windowAny.__designerFeedbackInjected ||
              windowAny.__designerFeedbackLoaderInjected
            ) {
              return false;
            }
            windowAny.__designerFeedbackLoaderInjected = true;
            return true;
          },
        },
        (results) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(Boolean(results?.[0]?.result));
        }
      );
    });

  const ensureContentScript = (tabId: number, url: string | null) =>
    new Promise<void>((resolve) => {
      if (!url || !isHttpUrl(url)) {
        resolve();
        return;
      }
      markInjectionIfNeeded(tabId)
        .then((shouldInject) => {
          if (!shouldInject) {
            resolve();
            return;
          }
          chrome.scripting.executeScript(
            {
              target: { tabId },
              files: [CONTENT_SCRIPT_FILE],
            },
            () => {
              if (chrome.runtime.lastError) {
                console.debug('Could not inject content script:', chrome.runtime.lastError.message);
              }
              resolve();
            }
          );
        })
        .catch(() => resolve());
    });

  const requestCurrentSiteAccess = async () => {
    if (!activeUrl) return false;
    const originPattern = getOriginPattern(activeUrl);
    if (!originPattern) return false;

    setPermissionNotice(null);
    setPermissionRequesting(true);
    const granted = await requestPermissions([originPattern]);
    setPermissionRequesting(false);
    if (!granted) {
      setPermissionNotice('Access was not granted for this site.');
      return false;
    }
    setHasSitePermission(true);
    if (activeTabId) {
      await ensureContentScript(activeTabId, activeUrl);
    }
    return true;
  };

  const requestAllSitesAccess = async () => {
    setPermissionNotice(null);
    setPermissionRequesting(true);
    const granted = await requestPermissions(['http://*/*', 'https://*/*']);
    setPermissionRequesting(false);
    if (!granted) {
      setPermissionNotice('All sites access was not granted.');
      return false;
    }
    setHasAllSitesPermission(true);
    if (activeTabId && activeUrl) {
      await ensureContentScript(activeTabId, activeUrl);
    }
    return true;
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
    refreshAllSitesPermission();

    const loadActiveTab = async () => {
      const tab = await getActiveTab();
      const url = tab?.url ?? null;
      setActiveTabId(tab?.id ?? null);
      setActiveUrl(url);
      setActiveHost(url ? getHostFromUrl(url) : null);
      refreshSitePermission(url);

      if (tab?.id) {
        await ensureContentScript(tab.id, url);
        chrome.tabs.sendMessage(
          tab.id,
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
    };

    void loadActiveTab();
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

  const handleToggle = async (enabled: boolean) => {
    const newSettings = { ...settings, enabled };
    setSettings(newSettings);
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to save settings:', chrome.runtime.lastError.message);
      }
    });

    const tab = await getActiveTab();
    if (tab?.id) {
      await ensureContentScript(tab.id, tab.url ?? null);
      chrome.tabs.sendMessage(
        tab.id,
        {
          type: 'TOGGLE_TOOLBAR',
          enabled,
        },
        () => {
          // Ignore errors - content script may not be loaded
          void chrome.runtime.lastError;
        }
      );
    }
  };

  const handleExport = async () => {
    const tab = await getActiveTab();
    if (tab?.id) {
      await ensureContentScript(tab.id, tab.url ?? null);
      chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_EXPORT' }, () => {
        // Ignore errors - content script may not be loaded
        void chrome.runtime.lastError;
      });
      window.close();
    }
  };

  const handleModeChange = async (mode: SiteListMode) => {
    if (mode === 'blocklist' && !hasAllSitesPermission) {
      const granted = await requestAllSitesAccess();
      if (!granted) return;
    }

    const newSettings = { ...settings, siteListMode: mode };
    setSettings(newSettings);
    chrome.storage.sync.set(newSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update site list mode:', chrome.runtime.lastError.message);
      }
    });
  };

  const handleSaveSiteList = async () => {
    const parsedList = parseSiteListInput(siteListText);
    const nextList = normalizeSiteList(parsedList);
    const formattedList = formatSiteList(nextList);
    const previousList = normalizeSiteList(settings.siteList);
    const addedEntries = nextList.filter((entry) => !previousList.includes(entry));

    if (settings.siteListMode === 'allowlist' && addedEntries.length > 0) {
      setPermissionNotice(null);
      setPermissionRequesting(true);
      const granted = await requestPermissions(siteListToOriginPatterns(addedEntries));
      setPermissionRequesting(false);
      if (!granted) {
        setPermissionNotice('Access was not granted for all added sites.');
      }
    }

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

  const handleAddCurrentSite = async () => {
    if (!activeHost || !activeUrl) return;
    await requestCurrentSiteAccess();

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
  const needsAllSitesAccess =
    settings.siteListMode === 'blocklist' && !hasAllSitesPermission;
  const needsCurrentSiteAccess =
    settings.siteListMode === 'allowlist' && isCurrentSiteAllowed && !hasSitePermission;
  const accessNoticeText = needsAllSitesAccess
    ? 'Enable access for all sites to keep the toolbar on automatically.'
    : needsCurrentSiteAccess
      ? 'Enable access for this site to keep the toolbar on automatically.'
      : null;
  const accessButtonLabel = needsAllSitesAccess ? 'Enable on all sites' : 'Enable on this site';

  return (
    <div className={styles.popup}>
      <div className={styles.header}>
        <h1 className={styles.title}>Designer Feedback</h1>
        <span className={styles.version}>v1.0.0</span>
      </div>

      {(accessNoticeText || permissionNotice) && (
        <div className={`${styles.section} ${styles.accessSection}`}>
          <div className={styles.accessHeader}>
            <span className={styles.accessTitle}>Access required</span>
            <span className={styles.accessPill}>
              {needsAllSitesAccess ? 'All sites' : 'This site'}
            </span>
          </div>
          {accessNoticeText && (
            <p className={styles.accessText}>{accessNoticeText}</p>
          )}
          {permissionNotice && (
            <p className={styles.accessSubtext}>{permissionNotice}</p>
          )}
          {accessNoticeText && (
            <button
              type="button"
              className={styles.accessPrimaryButton}
              onClick={needsAllSitesAccess ? requestAllSitesAccess : requestCurrentSiteAccess}
              disabled={permissionRequesting}
            >
              {permissionRequesting ? 'Requesting...' : accessButtonLabel}
            </button>
          )}
        </div>
      )}

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
            disabled={!canUseCurrentSite || !activeHost || permissionRequesting}
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
            disabled={siteListStatus !== 'dirty' || permissionRequesting}
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
