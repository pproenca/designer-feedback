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

export function Popup() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [annotationCount, setAnnotationCount] = useState(0);
  const [siteListText, setSiteListText] = useState('');
  const [savedSiteListText, setSavedSiteListText] = useState('');
  const [siteListStatus, setSiteListStatus] = useState<'idle' | 'dirty' | 'saved'>('idle');
  const saveStatusTimeoutRef = useRef<number | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeHost, setActiveHost] = useState<string | null>(null);
  const [hasSitePermission, setHasSitePermission] = useState(false);
  const [hasAllSitesPermission, setHasAllSitesPermission] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState<string | null>(null);
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);
  const [accessDetailsOpen, setAccessDetailsOpen] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Cache the active tab to avoid redundant chrome.tabs.query calls
  const cachedTabRef = useRef<chrome.tabs.Tab | null>(null);
  const canUseCurrentSite = useMemo(
    () => (activeUrl ? isHttpUrl(activeUrl) : false),
    [activeUrl]
  );
  const isCurrentSiteAllowed = useMemo(
    () => (activeUrl ? isUrlAllowed(activeUrl, settings) : false),
    [activeUrl, settings]
  );

  // Returns cached tab if available, otherwise queries and caches
  const getActiveTab = async (): Promise<chrome.tabs.Tab | null> => {
    if (cachedTabRef.current) {
      return cachedTabRef.current;
    }

    return new Promise<chrome.tabs.Tab | null>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to query tabs:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        const tab = tabs[0] ?? null;
        cachedTabRef.current = tab;
        resolve(tab);
      });
    });
  };

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
    return true;
  };

  useEffect(() => {
    // Load settings and onboarding state in a single batched call
    chrome.storage.sync.get(
      { ...DEFAULT_SETTINGS, onboardingComplete: false },
      (result) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to get settings:', chrome.runtime.lastError.message);
          setOnboardingComplete(false);
          setOnboardingLoaded(true);
          return;
        }

        // Extract and set settings
        const { onboardingComplete: onboardingState, ...settingsData } = result as Settings & {
          onboardingComplete: boolean;
        };
        const nextSettings = settingsData as Settings;
        setSettings(nextSettings);
        const formattedList = formatSiteList(nextSettings.siteList);
        setSiteListText(formattedList);
        setSavedSiteListText(formattedList);
        setSiteListStatus('idle');

        // Set onboarding state
        setOnboardingComplete(Boolean(onboardingState));
        setOnboardingLoaded(true);
      }
    );
    refreshAllSitesPermission();

    const loadActiveTab = async () => {
      const tab = await getActiveTab();
      const url = tab?.url ?? null;
      setActiveUrl(url);
      setActiveHost(url ? getHostFromUrl(url) : null);
      refreshSitePermission(url);

      if (tab?.id) {
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

  const handleActivateOnTab = async () => {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    setIsActivating(true);
    setPermissionNotice(null);

    // Send message to content script to activate toolbar
    chrome.tabs.sendMessage(
      tab.id,
      { type: 'ACTIVATE_TOOLBAR' },
      (response) => {
        setIsActivating(false);
        if (chrome.runtime.lastError) {
          setPermissionNotice('Failed to activate: ' + chrome.runtime.lastError.message);
          return;
        }
        if (response?.success) {
          // Close popup to show the toolbar on the page
          window.close();
        } else {
          setPermissionNotice(response?.error || 'Failed to activate on this page.');
        }
      }
    );
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

  const addHostToList = (host: string) => {
    const nextList = parseSiteListInput(`${siteListText}\n${host}`);
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

  const handleAddCurrentSite = async () => {
    if (!activeHost || !activeUrl) return;
    const granted = await requestCurrentSiteAccess();
    if (!granted) return;
    addHostToList(activeHost);
  };

  const markOnboardingComplete = () => {
    setOnboardingComplete(true);
    chrome.storage.sync.set({ onboardingComplete: true }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to store onboarding state:', chrome.runtime.lastError.message);
      }
    });
  };

  const handleOnboardingAllSites = async () => {
    const nextSettings = { ...settings, siteListMode: 'blocklist' as const };
    setSettings(nextSettings);
    chrome.storage.sync.set(nextSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update site list mode:', chrome.runtime.lastError.message);
      }
    });
    const granted = await requestAllSitesAccess();
    if (granted) {
      markOnboardingComplete();
    }
  };

  const handleOnboardingAllowlist = async () => {
    const nextSettings = { ...settings, siteListMode: 'allowlist' as const };
    setSettings(nextSettings);
    chrome.storage.sync.set(nextSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update site list mode:', chrome.runtime.lastError.message);
      }
    });
    let granted = true;
    if (activeUrl) {
      granted = await requestCurrentSiteAccess();
    }
    if (!granted) return;
    if (activeHost) {
      addHostToList(activeHost);
    }
    setAccessDetailsOpen(true);
    markOnboardingComplete();
  };

  const handleOnboardingClickMode = () => {
    const nextSettings = { ...settings, siteListMode: 'click' as const };
    setSettings(nextSettings);
    chrome.storage.sync.set(nextSettings, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update site list mode:', chrome.runtime.lastError.message);
      }
    });
    markOnboardingComplete();
  };

  const handleOnboardingSkip = () => {
    markOnboardingComplete();
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
  const showOnboarding = onboardingLoaded && !onboardingComplete;
  const showAccessSection = !showOnboarding && (accessNoticeText || permissionNotice);
  const isClickMode = settings.siteListMode === 'click';
  const showActivateSection = isClickMode && canUseCurrentSite;
  const siteAccessModeSummary =
    settings.siteListMode === 'click'
      ? 'Click to activate'
      : settings.siteListMode === 'allowlist'
        ? 'Allowlist'
        : 'All sites';

  return (
    <div className={styles.popup}>
      <div className={styles.header}>
        <h1 className={styles.title}>Designer Feedback</h1>
        <span className={styles.version}>v1.0.0</span>
      </div>

      {showOnboarding && (
        <div className={`${styles.section} ${styles.onboardingSection}`} aria-label="Get started">
          <div className={styles.onboardingHeader}>
            <span className={styles.onboardingTitle}>Get started</span>
            <span className={styles.onboardingPill}>Step 1</span>
          </div>
          <p className={styles.onboardingText}>
            Choose where Designer Feedback can run. You can change this later in Site access.
          </p>
          {permissionNotice && (
            <p className={styles.onboardingSubtext}>{permissionNotice}</p>
          )}
          <div className={styles.onboardingActions}>
            <button
              type="button"
              className={styles.accessPrimaryButton}
              onClick={handleOnboardingAllSites}
              disabled={permissionRequesting}
            >
              {permissionRequesting ? 'Requesting...' : 'Enable on all sites'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleOnboardingAllowlist}
              disabled={!canUseCurrentSite || permissionRequesting}
            >
              Only allow this site
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleOnboardingClickMode}
              disabled={permissionRequesting}
            >
              Click each time
            </button>
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.onboardingGhost}`}
              onClick={handleOnboardingSkip}
              disabled={permissionRequesting}
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {showAccessSection && (
        <div className={`${styles.section} ${styles.accessSection}`} aria-label="Access required">
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

      {showActivateSection && (
        <div className={`${styles.section} ${styles.accessSection}`} aria-label="Activate toolbar">
          <div className={styles.accessHeader}>
            <span className={styles.accessTitle}>Activate toolbar</span>
            <span className={styles.accessPill}>This page</span>
          </div>
          <p className={styles.accessText}>
            Click to activate the toolbar on this page. No permissions needed.
          </p>
          {permissionNotice && (
            <p className={styles.accessSubtext}>{permissionNotice}</p>
          )}
          <button
            type="button"
            className={styles.accessPrimaryButton}
            onClick={handleActivateOnTab}
            disabled={isActivating}
          >
            {isActivating ? 'Activating...' : 'Activate on this page'}
          </button>
        </div>
      )}

      <div className={`${styles.section} ${styles.summarySection}`}>
        <div className={styles.summaryRow}>
          <label className={styles.toggle}>
            <span className={styles.toggleLabel}>Enable Toolbar</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => handleToggle(e.target.checked)}
            />
            <span className={styles.toggleSwitch} />
          </label>
          <div className={styles.stats}>
            <span className={styles.statsLabel}>Annotations</span>
            <span className={styles.statsCount}>{annotationCount}</span>
          </div>
        </div>
        <button
          className={styles.exportButton}
          onClick={handleExport}
          disabled={annotationCount === 0}
          type="button"
        >
          Export Feedback
        </button>
      </div>

      <details
        className={styles.accessDetails}
        open={accessDetailsOpen}
        onToggle={(event) =>
          setAccessDetailsOpen((event.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary className={styles.accessSummary}>
          <span className={styles.accessSummaryTitle}>Site access</span>
          <span className={styles.accessSummaryMeta} aria-hidden="true">
            {siteAccessModeSummary}
          </span>
        </summary>
        <div className={styles.accessPanel}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Scope</span>
            <span className={styles.sectionMeta}>
              {siteAccessModeSummary}
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
              Allowlist
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${settings.siteListMode === 'click' ? styles.active : ''}`}
              onClick={() => handleModeChange('click')}
              aria-pressed={settings.siteListMode === 'click'}
            >
              Click
            </button>
          </div>

          {isClickMode ? (
            <p className={styles.helperText}>
              In click mode, click &quot;Activate on this page&quot; each time you want to use the
              toolbar. No site permissions are required.
            </p>
          ) : (
            <>
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
            </>
          )}
        </div>
      </details>
    </div>
  );
}
