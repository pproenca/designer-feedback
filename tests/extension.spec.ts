import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';

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
    await page.evaluate(async () => {
      await chrome.storage.sync.set({ enabled: true, lightMode: false });
    });
    await page.reload();
  });

  test('renders default state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Designer Feedback' })).toBeVisible();

    const toggle = page.getByRole('checkbox', { name: 'Enable Toolbar' });
    await expect(toggle).toBeChecked();

    await expect(page.getByText('Annotations on this page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Feedback' })).toBeDisabled();
  });

  test('toggle updates stored settings', async ({ page }) => {
    await page.getByText('Enable Toolbar').click();

    await expect.poll(async () => {
      return page.evaluate(async () => {
        const result = await chrome.storage.sync.get({ enabled: true });
        return result.enabled;
      });
    }).toBe(false);
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
