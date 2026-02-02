import {
  test as base,
  chromium,
  firefox,
  type BrowserContext,
  type Page,
  expect as baseExpect,
} from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import './types';
import {ToolbarPage, ExportModalPage} from './pages';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveExtensionPath(projectName: string): string {
  if (process.env.EXTENSION_PATH) {
    return process.env.EXTENSION_PATH;
  }

  const wxtBrowser = projectName === 'chromium' ? 'chrome' : projectName;
  const candidates = [
    path.join(__dirname, '..', '.output', `${wxtBrowser}-mv3`),
    path.join(__dirname, '..', '.output', `${wxtBrowser}-mv2`),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Extension build not found for "${projectName}". Run "npm run build" or set EXTENSION_PATH.`
  );
}

async function createTestExtensionDir(
  workerIndex: number,
  extensionPath: string
): Promise<string> {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), `designer-feedback-ext-${workerIndex}-`)
  );
  await fs.promises.cp(extensionPath, tempDir, {recursive: true});

  // For test automation, we inject broad host permissions so scripting can run
  // without activeTab user gestures. Production builds omit host permissions.
  const manifestPath = path.join(tempDir, 'manifest.json');
  const manifest = JSON.parse(
    await fs.promises.readFile(manifestPath, 'utf-8')
  );
  const permissionsMode = process.env.E2E_HOST_PERMISSIONS ?? 'broad';
  if (permissionsMode === 'broad') {
    manifest.host_permissions = ['http://*/*', 'https://*/*'];
  } else {
    delete manifest.host_permissions;
  }
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
  await baseExpect(page.locator('designer-feedback-root')).toBeAttached({
    timeout: 10000,
  });
  await baseExpect(page.locator('[data-toolbar]')).toBeVisible({
    timeout: 10000,
  });
}

/**
 * Activate the toolbar by navigating to the test-activate page.
 */
async function activateToolbar(
  page: Page,
  context: BrowserContext,
  extensionId: string
) {
  const targetUrl = page.url();
  console.log('[E2E] Activating toolbar for:', targetUrl);

  const activationPage = await context.newPage();
  await activationPage.goto(
    `${extensionId}/test-activate.html?target=${encodeURIComponent(targetUrl)}`
  );
  await activationPage.waitForLoadState('domcontentloaded');

  try {
    await activationPage.waitForFunction(
      () => {
        const status = window.__dfActivateStatus;
        return (
          status === 'done' ||
          (typeof status === 'string' && status.startsWith('error:'))
        );
      },
      {timeout: 5000}
    );
  } catch {
    const diagnostics = await activationPage.evaluate(() => ({
      status: window.__dfActivateStatus,
      debug: window.__dfActivateDebug,
      url: window.location.href,
    }));
    throw new Error(`Activation timed out: ${JSON.stringify(diagnostics)}`);
  }

  const status = await activationPage.evaluate(() => window.__dfActivateStatus);
  const debugInfo = await activationPage.evaluate(
    () => window.__dfActivateDebug
  );
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
  await page.getByRole('button', {name: 'Add annotation', exact: true}).click();
  await page.getByRole('button', {name: category, exact: true}).click();
  await baseExpect(page.locator('body').first()).toHaveClass(
    /designer-feedback-add-mode/
  );
  await page.getByRole('heading', {name: 'Example Domain'}).click();

  const popup = page.locator('[data-annotation-popup]');
  await baseExpect(popup).toBeVisible();
  await popup.getByPlaceholder('What should change?').fill(comment);
  await popup.getByRole('button', {name: 'Add'}).click();
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
  const minimizeButton = page.getByRole('button', {
    name: 'Minimize toolbar',
    exact: true,
  });
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
  await page.mouse.move(targetX, targetY, {steps: 20});
  await page.mouse.up();

  await toolbar.click();
  await baseExpect(
    page.getByRole('button', {name: 'Add annotation', exact: true})
  ).toBeVisible();
}

// ============================================================================
// Test Fixtures
// ============================================================================

interface TestHelpers {
  activateToolbar: () => Promise<void>;
  waitForToolbar: () => Promise<void>;
  createAnnotation: (
    comment: string,
    category: 'Bug' | 'Question' | 'Suggestion'
  ) => Promise<void>;
  getToolbarBounds: () => ReturnType<typeof getToolbarBounds>;
  dragToolbar: (targetX: number, targetY: number) => Promise<void>;
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  helpers: TestHelpers;
  toolbarPage: ToolbarPage;
  exportModal: ExportModalPage;
}>({
  context: async ({}, use, testInfo) => {
    const useHeadless = process.env.PWHEADLESS === '1';
    const userDataDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), `designer-feedback-${testInfo.workerIndex}-`)
    );
    const extensionPath = resolveExtensionPath(testInfo.project.name);
    const testExtensionPath = await createTestExtensionDir(
      testInfo.workerIndex,
      extensionPath
    );
    const isChromium = testInfo.project.name === 'chromium';
    const browserType = isChromium ? chromium : firefox;

    const launchArgs = isChromium
      ? [
          useHeadless ? '--headless=new' : '',
          `--disable-extensions-except=${testExtensionPath}`,
          `--load-extension=${testExtensionPath}`,
          ...(process.env.CI ? ['--disable-gpu', '--no-sandbox'] : []),
        ].filter(Boolean)
      : [];

    const context = await browserType.launchPersistentContext(userDataDir, {
      headless: false,
      args: launchArgs,
    });

    await use(context);
    await context.close();
    await fs.promises.rm(userDataDir, {recursive: true, force: true});
    await fs.promises.rm(testExtensionPath, {recursive: true, force: true});
  },
  extensionId: async ({context}, use, testInfo) => {
    let background: {url(): string};
    const extensionPath = resolveExtensionPath(testInfo.project.name);
    const isMV3 = extensionPath.endsWith('-mv3');

    if (isMV3) {
      [background] = context.serviceWorkers();
      if (!background) {
        background = await context.waitForEvent('serviceworker');
      }
    } else {
      [background] = context.backgroundPages();
      if (!background) {
        background = await context.waitForEvent('backgroundpage');
      }
    }

    const bgUrl = background.url();
    const extensionId = bgUrl.split('/')[2];
    const protocol = bgUrl.split(':')[0];
    await use(`${protocol}://${extensionId}`);
  },
  helpers: async ({page, context, extensionId}, use) => {
    await use({
      activateToolbar: () => activateToolbar(page, context, extensionId),
      waitForToolbar: () => waitForToolbar(page),
      createAnnotation: (comment, category) =>
        createAnnotation(page, comment, category),
      getToolbarBounds: () => getToolbarBounds(page),
      dragToolbar: (x, y) => dragToolbar(page, x, y),
    });
  },
  toolbarPage: async ({page}, use) => {
    await use(new ToolbarPage(page));
  },
  exportModal: async ({page}, use) => {
    await use(new ExportModalPage(page));
  },
});

export const expect = test.expect;
