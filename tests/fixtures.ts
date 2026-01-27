import { test as base, chromium, type BrowserContext } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = process.env.EXTENSION_PATH ?? path.join(__dirname, '..', 'dist');

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

  const manifestPath = path.join(tempDir, 'manifest.json');
  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf-8'));
  manifest.host_permissions = ['http://*/*', 'https://*/*'];
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return tempDir;
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
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
});

export const expect = test.expect;
