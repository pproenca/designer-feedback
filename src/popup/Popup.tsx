import { useState, useEffect } from 'react';
import type { Settings } from '@/types';
import styles from './styles.module.scss';

export function Popup() {
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    lightMode: false,
  });
  const [annotationCount, setAnnotationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load settings
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (response?.settings) {
        setSettings(response.settings);
      }
      setLoading(false);
    });

    // Get current tab's annotation count
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (url) {
        chrome.runtime.sendMessage(
          { type: 'GET_ANNOTATION_COUNT', url },
          (response) => {
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
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_TOOLBAR',
          enabled,
        });
      }
    });
  };

  const handleExport = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_EXPORT' });
        window.close();
      }
    });
  };

  if (loading) {
    return (
      <div className={styles.popup}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

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
        >
          Export Feedback
        </button>
      </div>
    </div>
  );
}
