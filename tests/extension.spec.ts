import { test, expect } from './fixtures';

async function openPopup(page: any, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
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
    const toggle = page.getByRole('checkbox', { name: 'Enable Toolbar' });
    await toggle.setChecked(false);

    const enabled = await page.evaluate(async () => {
      const result = await chrome.storage.sync.get({ enabled: true });
      return result.enabled;
    });

    expect(enabled).toBe(false);
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

    await page.waitForFunction(
      () => Boolean(document.getElementById('designer-feedback-root')),
      null,
      { timeout: 5000 }
    );

    const hasRoot = await page.evaluate(() => Boolean(document.getElementById('designer-feedback-root')));
    expect(hasRoot).toBe(true);
  });
});
