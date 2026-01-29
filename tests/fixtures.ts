import { test as base, chromium, type BrowserContext, type Page, expect as baseExpect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = process.env.EXTENSION_PATH ?? path.join(__dirname, '..', '.output', 'chrome-mv3');

if (!fs.existsSync(extensionPath)) {
  throw new Error(
    `Extension build not found at "${extensionPath}". Run "npm run build" before Playwright tests or set EXTENSION_PATH.`
  );
}

async function createTestExtensionDir(workerIndex: number): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), `designer-feedback-ext-${workerIndex}-`)
  );
  await fs.promises.cp(extensionPath, tempDir, { recursive: true });

  // For testing, we need to add host_permissions so the scripting API works
  // In production, activeTab grants these permissions when user clicks the icon
  const manifestPath = path.join(tempDir, 'manifest.json');
  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
  manifest.host_permissions = ['http://*/*', 'https://*/*'];
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return tempDir;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for the toolbar to be visible on the page.
 * The content script auto-mounts the toolbar when enabled.
 * The toolbar is rendered inside a shadow DOM.
 */
async function waitForToolbar(page: Page) {
  await baseExpect(page.locator('designer-feedback-root')).toBeAttached({ timeout: 10000 });
  await baseExpect(page.locator('[data-toolbar]')).toBeVisible({ timeout: 10000 });
}

/**
 * Activate the toolbar by navigating to the test-activate page.
 */
async function activateToolbar(page: Page, context: BrowserContext, extensionId: string) {
  const targetUrl = page.url();
  console.log('[E2E] Activating toolbar for:', targetUrl);

  const activationPage = await context.newPage();
  await activationPage.goto(
    `chrome-extension://${extensionId}/test-activate.html?target=${encodeURIComponent(targetUrl)}`
  );
  await activationPage.waitForLoadState('domcontentloaded');

  try {
    await activationPage.waitForFunction(() => {
      const status = window.__dfActivateStatus;
      return status === 'done' || (typeof status === 'string' && status.startsWith('error:'));
    }, { timeout: 5000 });
  } catch {
    const diagnostics = await activationPage.evaluate(() => ({
      status: window.__dfActivateStatus,
      debug: window.__dfActivateDebug,
      hasChrome: Boolean(window.chrome),
      hasScripting: Boolean(window.chrome?.scripting),
      url: window.location.href,
    }));
    throw new Error(`Activation timed out: ${JSON.stringify(diagnostics)}`);
  }

  const status = await activationPage.evaluate(() => window.__dfActivateStatus);
  const debugInfo = await activationPage.evaluate(() => window.__dfActivateDebug);
  console.log('[E2E] Activation status:', status);
  console.log('[E2E] Activation debug:', JSON.stringify(debugInfo, null, 2));

  if (status !== 'done') {
    const diagnostics = await activationPage.evaluate(() => ({
      status: window.__dfActivateStatus,
      debug: window.__dfActivateDebug,
    }));
    throw new Error(`Activation failed: ${JSON.stringify(diagnostics)}`);
  }

  await activationPage.close();
  await page.bringToFront();

  // Note: The flag __designerFeedbackInjected is set in the content script's
  // isolated world, not the main page world. Playwright's evaluate() runs in
  // the main page world, so we can't check the flag directly.
  // Instead, we wait for the shadow DOM element which IS visible to Playwright.
}

/**
 * Create an annotation on the page.
 */
async function createAnnotation(
  page: Page,
  comment: string,
  category: 'Bug' | 'Question' | 'Suggestion'
) {
  await page.getByRole('button', { name: 'Add annotation', exact: true }).click();
  await page.getByRole('button', { name: category, exact: true }).click();
  await baseExpect(page.locator('body').first()).toHaveClass(/designer-feedback-add-mode/);
  await page.getByRole('heading', { name: 'Example Domain' }).click();

  const popup = page.locator('[data-annotation-popup]');
  await baseExpect(popup).toBeVisible();
  await popup.getByPlaceholder('What should change?').fill(comment);
  await popup.getByRole('button', { name: 'Add' }).click();
  await baseExpect(page.locator('[data-annotation-marker]')).toHaveCount(1);
}

/**
 * Get the bounding box of the toolbar.
 */
async function getToolbarBounds(page: Page) {
  const toolbar = page.locator('[data-toolbar]');
  return toolbar.boundingBox();
}

/**
 * Drag the toolbar to a specific position.
 * Minimizes the toolbar first to avoid hitting buttons during drag.
 */
async function dragToolbar(page: Page, targetX: number, targetY: number) {
  const minimizeButton = page.getByRole('button', { name: 'Minimize toolbar', exact: true });
  if (await minimizeButton.isVisible()) {
    await minimizeButton.click();
    await baseExpect(minimizeButton).toBeHidden();
  }

  const toolbar = page.locator('[data-toolbar]');
  const bounds = await toolbar.boundingBox();
  if (!bounds) throw new Error('Toolbar not found');

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 20 });
  await page.mouse.up();

  await toolbar.click();
  await baseExpect(page.getByRole('button', { name: 'Add annotation', exact: true })).toBeVisible();
}

// ============================================================================
// Test Fixtures
// ============================================================================

export interface TestHelpers {
  activateToolbar: () => Promise<void>;
  waitForToolbar: () => Promise<void>;
  createAnnotation: (comment: string, category: 'Bug' | 'Question' | 'Suggestion') => Promise<void>;
  getToolbarBounds: () => ReturnType<typeof getToolbarBounds>;
  dragToolbar: (targetX: number, targetY: number) => Promise<void>;
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  helpers: TestHelpers;
}>({
  context: async ({}, use, testInfo) => {
    const useHeadless = process.env.PWHEADLESS === '1';
    const userDataDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), `designer-feedback-${testInfo.workerIndex}-`)
    );
    const testExtensionPath = await createTestExtensionDir(testInfo.workerIndex);

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        useHeadless ? '--headless=new' : '',
        `--disable-extensions-except=${testExtensionPath}`,
        `--load-extension=${testExtensionPath}`,
        ...(process.env.CI ? ['--disable-gpu', '--no-sandbox'] : []),
      ].filter(Boolean),
    });
    await use(context);
    await context.close();
    await fs.promises.rm(userDataDir, { recursive: true, force: true });
    await fs.promises.rm(testExtensionPath, { recursive: true, force: true });
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },
  helpers: async ({ page, context, extensionId }, use) => {
    await use({
      activateToolbar: () => activateToolbar(page, context, extensionId),
      waitForToolbar: () => waitForToolbar(page),
      createAnnotation: (comment, category) => createAnnotation(page, comment, category),
      getToolbarBounds: () => getToolbarBounds(page),
      dragToolbar: (x, y) => dragToolbar(page, x, y),
    });
  },
});

export const expect = test.expect;
