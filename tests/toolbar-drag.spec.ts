import type { Page, BrowserContext } from '@playwright/test';
import { test, expect } from './fixtures';

/**
 * Wait for the toolbar to be visible on the page.
 */
async function waitForToolbar(page: Page) {
  await expect(page.locator('#designer-feedback-root')).toBeAttached({ timeout: 10000 });
  await expect(page.locator('#designer-feedback-root [data-toolbar]')).toBeVisible({
    timeout: 10000,
  });
}

async function activateToolbar(page: Page, context: BrowserContext, extensionId: string) {
  const targetUrl = page.url();
  const activationPage = await context.newPage();
  await activationPage.goto(
    `chrome-extension://${extensionId}/test-activate.html?target=${encodeURIComponent(targetUrl)}`
  );
  await activationPage.waitForLoadState('domcontentloaded');
  try {
    await activationPage.waitForFunction(() => {
      const status = window['__dfActivateStatus'];
      return status === 'done' || (typeof status === 'string' && status.startsWith('error:'));
    }, { timeout: 2000 });
  } catch {
    const diagnostics = await activationPage.evaluate(() => ({
      status: window['__dfActivateStatus'],
      debug: window['__dfActivateDebug'],
      hasChrome: Boolean(window.chrome),
      hasScripting: Boolean(window.chrome?.scripting),
      url: window.location.href,
    }));
    throw new Error(`Activation timed out: ${JSON.stringify(diagnostics)}`);
  }
  const status = await activationPage.evaluate(() => window['__dfActivateStatus']);
  if (status !== 'done') {
    const diagnostics = await activationPage.evaluate(() => ({
      status: window['__dfActivateStatus'],
      debug: window['__dfActivateDebug'],
    }));
    throw new Error(`Activation failed: ${JSON.stringify(diagnostics)}`);
  }
  await activationPage.close();
  await page.bringToFront();
  await page.waitForFunction(() => window.__designerFeedbackInjected === true, {
    timeout: 2000,
  });
}

/**
 * Get the bounding box of the toolbar
 */
async function getToolbarBounds(page: Page) {
  const toolbar = page.locator('[data-toolbar]');
  return toolbar.boundingBox();
}

/**
 * Drag the toolbar to a specific position
 * Use Playwright's native drag mechanism which handles shadow DOM correctly
 */
async function dragToolbar(page: Page, targetX: number, targetY: number) {
  // First minimize the toolbar so we can drag without hitting buttons
  const minimizeButton = page.getByRole('button', { name: 'Minimize toolbar', exact: true });
  if (await minimizeButton.isVisible()) {
    await minimizeButton.click();
    // Wait for collapse animation by checking that the button is hidden
    await expect(minimizeButton).toBeHidden();
  }

  const toolbar = page.locator('[data-toolbar]');
  const bounds = await toolbar.boundingBox();
  if (!bounds) throw new Error('Toolbar not found');

  // Calculate the center of the collapsed toolbar
  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;

  // Perform drag operation
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move in steps to ensure drag threshold is exceeded
  await page.mouse.move(targetX, targetY, { steps: 20 });
  await page.mouse.up();

  // Expand toolbar back by clicking and waiting for expand animation
  await toolbar.click();
  // Wait for expand animation by checking that add button is visible
  await expect(page.getByRole('button', { name: 'Add annotation', exact: true })).toBeVisible();
}

test.describe('Toolbar Drag Behavior', () => {
  test.beforeEach(async ({ page, context, extensionId }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await activateToolbar(page, context, extensionId);
    await waitForToolbar(page);
  });

  test('toolbar can be dragged to a new position', async ({ page }) => {
    const initialBounds = await getToolbarBounds(page);
    expect(initialBounds).not.toBeNull();

    // Drag to the middle of the viewport
    const viewportSize = page.viewportSize();
    const targetX = viewportSize!.width / 2;
    const targetY = viewportSize!.height / 2;

    await dragToolbar(page, targetX, targetY);

    const newBounds = await getToolbarBounds(page);
    expect(newBounds).not.toBeNull();

    // Toolbar should have moved (position changed)
    expect(newBounds!.x).not.toBe(initialBounds!.x);
    expect(newBounds!.y).not.toBe(initialBounds!.y);
  });
});
