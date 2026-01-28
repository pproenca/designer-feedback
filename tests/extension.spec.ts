import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';

const DEFAULT_TEST_SETTINGS = {
  enabled: true,
  lightMode: false,
  siteListMode: 'blocklist',
  siteList: [],
};

async function openPopup(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
}

async function openSiteAccess(page: Page) {
  await page.locator('summary', { hasText: 'Site access' }).click();
}

async function setExtensionSettings(
  context: BrowserContext,
  extensionId: string,
  settings: Record<string, unknown>
) {
  const settingsPage = await context.newPage();
  await openPopup(settingsPage, extensionId);
  await settingsPage.evaluate(async (settingsToSave) => {
    await chrome.storage.sync.set(settingsToSave);
  }, settings);
  await settingsPage.close();
}

async function clearAnnotationsStorage(context: BrowserContext, extensionId: string) {
  const settingsPage = await context.newPage();
  await openPopup(settingsPage, extensionId);
  await settingsPage.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((key) =>
      key.startsWith('designer-feedback:annotations:')
    );
    if (keys.length > 0) {
      await chrome.storage.local.remove(keys);
    }
  });
  await settingsPage.close();
}

async function getStoredSettings(page: Page) {
  return page.evaluate(async (defaults) => {
    const result = await chrome.storage.sync.get(defaults);
    return result;
  }, DEFAULT_TEST_SETTINGS);
}

async function prepareContentPage(page: Page, context: BrowserContext, extensionId: string) {
  await setExtensionSettings(context, extensionId, { enabled: true, lightMode: false });
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  await clearAnnotationsStorage(context, extensionId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#designer-feedback-root')).toHaveCount(1);
}

async function createAnnotation(
  page: Page,
  comment: string,
  category: 'Bug' | 'Question' | 'Suggestion'
) {
  await page.getByRole('button', { name: 'Add annotation' }).click();
  await page.getByRole('button', { name: category }).click();
  await expect(page.locator('body')).toHaveClass(/designer-feedback-add-mode/);
  await page.getByRole('heading', { name: 'Example Domain' }).click();

  const popup = page.locator('[data-annotation-popup]');
  await expect(popup).toBeVisible();
  await popup.getByPlaceholder('What should change?').fill(comment);
  await popup.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-annotation-marker]')).toHaveCount(1);
}

test.describe('Popup UI', () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await openPopup(page, extensionId);
    await page.evaluate(async (settings) => {
      await chrome.storage.sync.set(settings);
    }, DEFAULT_TEST_SETTINGS);
    await page.reload();
  });

  test('renders default state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Designer Feedback' })).toBeVisible();

    const toggle = page.getByRole('checkbox', { name: 'Enable Toolbar' });
    await expect(toggle).toBeChecked();

    await expect(page.getByText('Annotations', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Feedback' })).toBeDisabled();

    await expect(page.getByText('Site access', { exact: true })).toBeVisible();
    await openSiteAccess(page);
    await expect(page.getByRole('button', { name: 'All sites', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByLabel('Blocked sites')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Disable on this site' })).toBeDisabled();
  });

  test('toggle updates stored settings', async ({ page }) => {
    await page.getByText('Enable Toolbar').click();

    await expect.poll(async () => {
      const settings = await getStoredSettings(page);
      return settings.enabled;
    }).toBe(false);
  });

  test('happy path: saves allowlist settings', async ({ page }) => {
    await openSiteAccess(page);
    await page.getByRole('button', { name: 'Only allowlist' }).click();

    const siteList = page.getByLabel('Allowed sites');
    await siteList.fill(`Example.com
https://example.com/admin
# comment
/admin
EXAMPLE.com`);
    await expect(page.getByRole('status')).toHaveText('Unsaved changes');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(siteList).toHaveValue('example.com\nexample.com/admin');
    await expect.poll(async () => {
      const settings = await getStoredSettings(page);
      return { siteListMode: settings.siteListMode, siteList: settings.siteList };
    }).toEqual({
      siteListMode: 'allowlist',
      siteList: ['example.com', 'example.com/admin'],
    });
    await expect(page.getByRole('button', { name: /Save/ })).toBeDisabled();
  });

  test('happy path: add current site shortcut saves host', async ({ context, extensionId }) => {
    const popupPage = await context.newPage();
    await popupPage.addInitScript(({ url, tabId }) => {
      if (!window.chrome) {
        // @ts-expect-error - test-only shim.
        window.chrome = {};
      }
      if (!window.chrome.tabs) {
        // @ts-expect-error - test-only shim.
        window.chrome.tabs = {};
      }
      window.chrome.tabs.query = (_queryInfo, callback) => {
        callback([{ id: tabId, url }]);
      };
      window.chrome.tabs.sendMessage = (_id, _message, callback) => {
        if (callback) {
          callback({ count: 0 });
        }
      };
    }, { url: 'https://example.com/admin', tabId: 777 });

    await openPopup(popupPage, extensionId);
    await popupPage.evaluate(async (settings) => {
      await chrome.storage.sync.set(settings);
    }, DEFAULT_TEST_SETTINGS);
    await popupPage.reload();

    await openSiteAccess(popupPage);
    const addButton = popupPage.getByRole('button', { name: 'Disable on this site' });
    await expect(addButton).toBeEnabled();
    await addButton.click();

    await expect(popupPage.getByLabel('Blocked sites')).toHaveValue('example.com');
    await expect.poll(async () => {
      const settings = await getStoredSettings(popupPage);
      return settings.siteList;
    }).toEqual(['example.com']);
    await expect(popupPage.getByRole('status')).toHaveText('Saved');
    await expect(popupPage.getByRole('button', { name: 'Saved' })).toBeDisabled();
    await popupPage.close();
  });

  test('sad path: ignores invalid site list entries', async ({ page }) => {
    await openSiteAccess(page);
    const siteList = page.getByLabel('Blocked sites');
    await siteList.fill(`# comment
/admin
http://
`);
    await expect(page.getByRole('status')).toHaveText('Unsaved changes');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(siteList).toHaveValue('');
    await expect.poll(async () => {
      const settings = await getStoredSettings(page);
      return settings.siteList;
    }).toEqual([]);
    await expect(page.getByRole('button', { name: /Save/ })).toBeDisabled();
  });

  test('save status transitions from dirty to saved to idle', async ({ page }) => {
    await openSiteAccess(page);
    const siteList = page.getByLabel('Blocked sites');
    await siteList.fill('example.com');

    await expect(page.getByRole('status')).toHaveText('Unsaved changes');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('status')).toHaveText('Saved');
    await expect(page.getByRole('button', { name: 'Saved' })).toBeDisabled();

    await expect.poll(async () => {
      return (await page.getByRole('status').textContent())?.trim();
    }).toBe('');
    await expect(page.getByRole('button', { name: 'Save list' })).toBeDisabled();
  });

  test('mode switch toggles labels and storage', async ({ page }) => {
    await openSiteAccess(page);
    await page.getByRole('button', { name: 'Only allowlist' }).click();

    await expect(page.getByText('Allowlist', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Allowed sites')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Allow this site', exact: true })).toBeVisible();
    await expect.poll(async () => {
      const settings = await getStoredSettings(page);
      return settings.siteListMode;
    }).toBe('allowlist');

    await page.getByRole('button', { name: 'All sites', exact: true }).click();

    await expect(page.getByText('Blocklist', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Blocked sites')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable on this site', exact: true })).toBeVisible();
    await expect.poll(async () => {
      const settings = await getStoredSettings(page);
      return settings.siteListMode;
    }).toBe('blocklist');
  });

  test('permission callout requests all-sites access', async ({ context, extensionId }) => {
    const popupPage = await context.newPage();
    await popupPage.addInitScript(() => {
      const win = window as Window & { __permissionRequests?: unknown[] };
      win.__permissionRequests = [];
      // Stub permissions to simulate missing host access.
      chrome.permissions.contains = (_info, callback) => {
        callback(false);
      };
      chrome.permissions.request = (info, callback) => {
        win.__permissionRequests?.push(info);
        callback(true);
      };
    });

    await openPopup(popupPage, extensionId);
    await popupPage.evaluate(async (settings) => {
      await chrome.storage.sync.set(settings);
    }, { ...DEFAULT_TEST_SETTINGS, onboardingComplete: true });
    await popupPage.reload();

    await expect(
      popupPage.getByText(
        'Enable access for all sites to keep the toolbar on automatically.'
      )
    ).toBeVisible();

    const enableButton = popupPage.getByRole('button', { name: 'Enable on all sites' });
    await enableButton.click();

    await expect(enableButton).toHaveCount(0);
    await expect(
      popupPage.getByText(
        'Enable access for all sites to keep the toolbar on automatically.'
      )
    ).toHaveCount(0);

    const permissionRequests = await popupPage.evaluate(
      () => (window as Window & { __permissionRequests?: unknown[] }).__permissionRequests
    );
    expect(permissionRequests).toEqual([{ origins: ['http://*/*', 'https://*/*'] }]);
    await popupPage.close();
  });
});

test.describe('Content Script', () => {
  test('injects UI container on pages', async ({ context, extensionId }) => {
    const settingsPage = await context.newPage();
    await openPopup(settingsPage, extensionId);
    await settingsPage.evaluate(async () => {
      await chrome.storage.sync.set({ enabled: true, lightMode: false });
    });
    await settingsPage.close();

    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#designer-feedback-root')).toHaveCount(1);
  });
});

test.describe('Feedback Toolbar flows', () => {
  test.beforeEach(async ({ page, context, extensionId }) => {
    await prepareContentPage(page, context, extensionId);
    await expect(page.getByRole('button', { name: 'Add annotation' })).toBeVisible();
  });

  test('happy path: create annotation and open export modal', async ({ page }) => {
    const comment = 'Tighten spacing above the headline.';
    await createAnnotation(page, comment, 'Bug');

    const exportButton = page.getByRole('button', { name: 'Export feedback' });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();

    await expect(page.getByRole('heading', { name: 'Export Feedback' })).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();
    await page.getByRole('button', { name: 'Close export dialog' }).click();
  });

  test('happy path: delete annotation from marker', async ({ page }) => {
    const comment = 'Update the hero copy.';
    await createAnnotation(page, comment, 'Suggestion');

    await page.locator('[data-annotation-marker]').first().click();
    const popup = page.locator('[data-annotation-popup]');
    await expect(popup.getByText(comment)).toBeVisible();
    await popup.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('[data-annotation-marker]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export feedback' })).toBeDisabled();
  });

  test('sad path: cancel add flow does not create annotation', async ({ page }) => {
    await page.getByRole('button', { name: 'Add annotation' }).click();
    await page.getByRole('button', { name: 'Question' }).click();
    await page.getByRole('heading', { name: 'Example Domain' }).click();

    const popup = page.locator('[data-annotation-popup]');
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Add' })).toBeDisabled();
    await popup.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('[data-annotation-marker]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export feedback' })).toBeDisabled();
  });

  test('stores annotations in extension storage (not page IndexedDB)', async ({
    page,
    context,
    extensionId,
  }) => {
    const comment = 'Check storage location.';

    const supportsDatabases = await page.evaluate(() => 'databases' in indexedDB);
    if (supportsDatabases) {
      const before = await page.evaluate(async () => indexedDB.databases());
      expect(before?.some((db) => db.name === 'designer-feedback-db')).toBe(false);
    }

    await createAnnotation(page, comment, 'Suggestion');

    if (supportsDatabases) {
      const after = await page.evaluate(async () => indexedDB.databases());
      expect(after?.some((db) => db.name === 'designer-feedback-db')).toBe(false);
    }

    const storagePage = await context.newPage();
    await openPopup(storagePage, extensionId);
    const storedCount = await storagePage.evaluate(async () => {
      const all = await chrome.storage.local.get(null);
      const entries = Object.entries(all).filter(([key]) =>
        key.startsWith('designer-feedback:annotations:')
      );
      const counts = entries.map(([, value]) =>
        Array.isArray(value) ? value.length : 0
      );
      return counts.reduce((sum, value) => sum + value, 0);
    });
    await storagePage.close();

    expect(storedCount).toBe(1);
  });
});
