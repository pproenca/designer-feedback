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

async function clearAnnotationsDb(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase('designer-feedback-db');
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      })
  );
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
  await clearAnnotationsDb(page);
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

    await expect(page.getByText('Annotations on this page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Feedback' })).toBeDisabled();

    await expect(page.getByText('Site access')).toBeVisible();
    await expect(page.getByRole('button', { name: 'All sites' })).toHaveAttribute(
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

  test('sad path: ignores invalid site list entries', async ({ page }) => {
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
});
