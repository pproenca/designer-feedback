import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Wait for the toolbar to be visible on the page.
 * The content script auto-mounts the toolbar when enabled.
 * The toolbar is rendered inside a shadow DOM, so we check for
 * the toolbar element using shadow DOM piercing.
 */
async function waitForToolbar(page: Page) {
  // Wait for the shadow host to be attached
  await expect(page.locator('#designer-feedback-root')).toBeAttached({ timeout: 10000 });
  // Wait for the actual toolbar inside the shadow DOM to be visible
  await expect(page.locator('#designer-feedback-root [data-toolbar]')).toBeVisible({ timeout: 10000 });
}

async function createAnnotation(
  page: Page,
  comment: string,
  category: 'Bug' | 'Question' | 'Suggestion'
) {
  await page.getByRole('button', { name: 'Add annotation', exact: true }).click();
  await page.getByRole('button', { name: category, exact: true }).click();
  await expect(page.locator('body')).toHaveClass(/designer-feedback-add-mode/);
  await page.getByRole('heading', { name: 'Example Domain' }).click();

  const popup = page.locator('[data-annotation-popup]');
  await expect(popup).toBeVisible();
  await popup.getByPlaceholder('What should change?').fill(comment);
  await popup.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-annotation-marker]')).toHaveCount(1);
}

test.describe('Extension Basic Tests', () => {
  test('service worker loads successfully', async ({ context, extensionId }) => {
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);
    expect(serviceWorkers.some((sw) => sw.url().includes(extensionId))).toBe(true);
  });

  test('content script injects toolbar on page load', async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await waitForToolbar(page);
    await expect(page.getByRole('button', { name: 'Add annotation', exact: true })).toBeVisible();
  });
});

test.describe('Toolbar UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await waitForToolbar(page);
  });

  test('displays all toolbar controls', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Add annotation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export feedback', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all annotations', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Minimize toolbar', exact: true })).toBeVisible();
  });

  test('can minimize and expand toolbar', async ({ page }) => {
    await page.getByRole('button', { name: 'Minimize toolbar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add annotation', exact: true })).toBeHidden();

    const toolbar = page.locator('[data-toolbar]');
    await toolbar.click();
    await expect(page.getByRole('button', { name: 'Add annotation', exact: true })).toBeVisible();
  });

  test('theme toggle switches between light and dark mode', async ({ page }) => {
    // Initially in light mode (default), button shows "Switch to dark mode"
    const switchToLightButton = page.getByRole('button', { name: 'Switch to light mode', exact: true });
    const switchToDarkButton = page.getByRole('button', { name: 'Switch to dark mode', exact: true });

    await expect(switchToDarkButton).toBeVisible();

    await switchToDarkButton.click();
    await expect(switchToLightButton).toBeVisible();

    await switchToLightButton.click();
    await expect(switchToDarkButton).toBeVisible();
  });
});

test.describe('Feedback Toolbar flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await waitForToolbar(page);
    // Note: Each test runs in a fresh browser context, so storage is already clean
  });

  test('happy path: create annotation and open export modal', async ({ page }) => {
    const comment = 'Tighten spacing above the headline.';
    await createAnnotation(page, comment, 'Bug');

    const exportButton = page.getByRole('button', { name: 'Export feedback', exact: true });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();

    await expect(page.getByRole('heading', { name: 'Export Feedback' })).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();
    await page.getByRole('dialog', { name: 'Export feedback' }).getByLabel('Close export dialog').click();
  });

  test('happy path: delete annotation from marker', async ({ page }) => {
    const comment = 'Update the hero copy.';
    await createAnnotation(page, comment, 'Suggestion');

    await page.locator('[data-annotation-marker]').first().click();
    const popup = page.locator('[data-annotation-popup]');
    await expect(popup.getByText(comment)).toBeVisible();
    await popup.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('[data-annotation-marker]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export feedback', exact: true })).toBeDisabled();
  });

  test('sad path: cancel add flow does not create annotation', async ({ page }) => {
    await page.getByRole('button', { name: 'Add annotation', exact: true }).click();
    await page.getByRole('button', { name: 'Question', exact: true }).click();
    await page.getByRole('heading', { name: 'Example Domain' }).click();

    const popup = page.locator('[data-annotation-popup]');
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('button', { name: 'Add' })).toBeDisabled();
    await popup.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('[data-annotation-marker]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export feedback', exact: true })).toBeDisabled();
  });

  test('stores annotations in extension storage (not page IndexedDB)', async ({ page }) => {
    const comment = 'Check storage location.';

    // Verify IndexedDB is not used before creating annotation
    const before = await page.evaluate(async () => {
      try {
        return await indexedDB.databases();
      } catch {
        return [];
      }
    });
    expect(before?.some((db) => db.name === 'designer-feedback-db')).toBe(false);

    await createAnnotation(page, comment, 'Suggestion');

    // Verify IndexedDB is still not used after creating annotation
    const after = await page.evaluate(async () => {
      try {
        return await indexedDB.databases();
      } catch {
        return [];
      }
    });
    expect(after?.some((db) => db.name === 'designer-feedback-db')).toBe(false);

    // Verify annotation persists after page reload (proves it's stored somewhere persistent)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForToolbar(page);
    await expect(page.locator('[data-annotation-marker]')).toHaveCount(1);
  });
});
