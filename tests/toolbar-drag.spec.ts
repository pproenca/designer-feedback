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

  test('toolbar on right side expands left (does not shift horizontally on expand/collapse)', async ({
    page,
  }) => {
    // Expand toolbar is already expanded by default, so minimize it first
    await page.getByRole('button', { name: 'Minimize toolbar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Add annotation', exact: true })
    ).toBeHidden();

    // Get collapsed position (right edge)
    const collapsedBounds = await getToolbarBounds(page);
    expect(collapsedBounds).not.toBeNull();
    const collapsedRightEdge = collapsedBounds!.x + collapsedBounds!.width;

    // Expand the toolbar
    await page.locator('[data-toolbar]').click();
    await expect(
      page.getByRole('button', { name: 'Add annotation', exact: true })
    ).toBeVisible();

    // Get expanded position (right edge should stay the same)
    const expandedBounds = await getToolbarBounds(page);
    expect(expandedBounds).not.toBeNull();
    const expandedRightEdge = expandedBounds!.x + expandedBounds!.width;

    // Right edge should be approximately the same (within 5px tolerance for CSS transitions)
    expect(Math.abs(expandedRightEdge - collapsedRightEdge)).toBeLessThan(5);
  });

  test('toolbar dragged to left side expands right (does not shift horizontally on expand/collapse)', async ({
    page,
  }) => {
    // Drag toolbar to left side of screen
    await dragToolbar(page, 100, 100);

    // Minimize toolbar
    await page.getByRole('button', { name: 'Minimize toolbar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Add annotation', exact: true })
    ).toBeHidden();

    // Get collapsed position (left edge)
    const collapsedBounds = await getToolbarBounds(page);
    expect(collapsedBounds).not.toBeNull();
    const collapsedLeftEdge = collapsedBounds!.x;

    // Expand the toolbar
    await page.locator('[data-toolbar]').click();
    await expect(
      page.getByRole('button', { name: 'Add annotation', exact: true })
    ).toBeVisible();

    // Get expanded position (left edge should stay the same)
    const expandedBounds = await getToolbarBounds(page);
    expect(expandedBounds).not.toBeNull();
    const expandedLeftEdge = expandedBounds!.x;

    // Left edge should be approximately the same (within 5px tolerance for CSS transitions)
    expect(Math.abs(expandedLeftEdge - collapsedLeftEdge)).toBeLessThan(5);
  });

  test('toolbar position persists after page reload', async ({ page }) => {
    // Drag toolbar to a specific position
    const viewportSize = page.viewportSize();
    const targetX = viewportSize!.width / 3;
    const targetY = viewportSize!.height / 3;

    await dragToolbar(page, targetX, targetY);

    // Get position after drag
    const boundsBeforeReload = await getToolbarBounds(page);
    expect(boundsBeforeReload).not.toBeNull();

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForToolbar(page);

    // Get position after reload
    const boundsAfterReload = await getToolbarBounds(page);
    expect(boundsAfterReload).not.toBeNull();

    // Position should be approximately the same (within 10px tolerance)
    expect(Math.abs(boundsAfterReload!.x - boundsBeforeReload!.x)).toBeLessThan(10);
    expect(Math.abs(boundsAfterReload!.y - boundsBeforeReload!.y)).toBeLessThan(10);
  });

  test('toolbar position is per-origin (different on different sites)', async ({
    page,
    context,
    extensionId,
  }) => {
    // Drag toolbar on example.com
    await dragToolbar(page, 100, 100);
    const exampleBounds = await getToolbarBounds(page);

    // Open a different site
    const newPage = await context.newPage();
    await newPage.goto('https://www.iana.org', { waitUntil: 'domcontentloaded' });
    await activateToolbar(newPage, context, extensionId);
    await waitForToolbar(newPage);

    // Toolbar should be at default position (not the dragged position)
    const ianaBounds = await getToolbarBounds(newPage);
    expect(ianaBounds).not.toBeNull();

    // Drag toolbar on iana.org to a different position
    await dragToolbar(newPage, 200, 200);
    const ianaNewBounds = await getToolbarBounds(newPage);

    // The positions should be different
    expect(ianaNewBounds!.x).not.toBe(exampleBounds!.x);
    expect(ianaNewBounds!.y).not.toBe(exampleBounds!.y);

    // Go back to example.com and verify position is preserved
    await page.bringToFront();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await activateToolbar(page, context, extensionId);
    await waitForToolbar(page);

    const exampleReloadBounds = await getToolbarBounds(page);
    expect(Math.abs(exampleReloadBounds!.x - exampleBounds!.x)).toBeLessThan(10);
    expect(Math.abs(exampleReloadBounds!.y - exampleBounds!.y)).toBeLessThan(10);

    await newPage.close();
  });
});
