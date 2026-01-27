import { useState, useEffect } from 'react';
import type { Settings } from '@/types';
import styles from './styles.module.scss';

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  lightMode: false,
};

export function Popup() {
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    lightMode: false,
  });
  const [annotationCount, setAnnotationCount] = useState(0);
  useEffect(() => {
    // Load settings
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to get settings:', chrome.runtime.lastError.message);
        return;
      }
      setSettings(result as Settings);
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
    </div>
  );
}
