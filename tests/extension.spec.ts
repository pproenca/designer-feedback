import { test, expect } from './fixtures';
import './types';

test.describe('Extension Basic Tests', () => {
  test('service worker loads successfully', async ({ context, extensionId }) => {
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);
    expect(serviceWorkers.some((sw) => sw.url().includes(extensionId))).toBe(true);
  });

  test('toolbar activates on action click', async ({ page, helpers }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await helpers.activateToolbar();
    await helpers.waitForToolbar();
    await expect(page.getByRole('button', { name: 'Add annotation', exact: true })).toBeVisible();
  });
});

test.describe('Feedback Toolbar flows', () => {
  test.beforeEach(async ({ page, helpers }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await helpers.activateToolbar();
    await helpers.waitForToolbar();
  });

  test('happy path: create annotation and open export modal', async ({ page, helpers }) => {
    const comment = 'Tighten spacing above the headline.';
    await helpers.createAnnotation(comment, 'Bug');

    const exportButton = page.getByRole('button', { name: 'Export feedback', exact: true });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();

    const exportDialog = page.getByRole('dialog', { name: 'Export feedback' });
    await expect(page.getByRole('heading', { name: 'Export Feedback' })).toBeVisible();
    await expect(exportDialog.getByText(comment)).toBeVisible();
    await exportDialog.getByLabel('Close export dialog').click();
  });

  test('happy path: delete annotation from marker', async ({ page, helpers }) => {
    const comment = 'Update the hero copy.';
    await helpers.createAnnotation(comment, 'Suggestion');

    await page.locator('[data-annotation-marker]').first().click();
    const popup = page.locator('[data-annotation-popup]');
    await expect(popup.getByText(comment)).toBeVisible();
    await popup.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('[data-annotation-marker]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Export feedback', exact: true })).toBeDisabled();
  });
});
