import { test as base, chromium, type BrowserContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const extensionPath = process.env.EXTENSION_PATH ?? path.join(__dirname, '..', 'dist');

if (!fs.existsSync(extensionPath)) {
  throw new Error(
    `Extension build not found at "${extensionPath}". Run "npm run build" before Playwright tests or set EXTENSION_PATH.`
  );
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const useHeadless = process.env.PWHEADLESS === '1';

    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        useHeadless ? '--headless=new' : '',
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        ...(process.env.CI ? ['--disable-gpu', '--no-sandbox'] : []),
      ].filter(Boolean),
    });
    await use(context);
    await context.close();
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
