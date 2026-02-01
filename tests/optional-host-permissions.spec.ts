import {test, expect} from './fixtures';
import type {BrowserContext, Page} from '@playwright/test';
import './types';

const shouldRunOptional =
  process.env.E2E_HOST_PERMISSIONS === 'optional' &&
  process.env.E2E_OPTIONAL_HOST_MANUAL === '1';

async function waitForActivation(activationPage: Page): Promise<{
  debug: unknown;
  status: string;
}> {
  try {
    await activationPage.waitForFunction(
      () => {
        const status = window.__dfActivateStatus;
        return (
          status === 'done' ||
          (typeof status === 'string' && status.startsWith('error:'))
        );
      },
      {timeout: 60000}
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
  const debug = await activationPage.evaluate(() => window.__dfActivateDebug);
  return {status: String(status), debug};
}

async function activateWithGesture(
  context: BrowserContext,
  extensionId: string,
  targetUrl: string
): Promise<{status: string; debug: unknown}> {
  const activationPage = await context.newPage();
  await activationPage.goto(
    `${extensionId}/test-activate.html?mode=gesture&target=${encodeURIComponent(
      targetUrl
    )}`
  );
  await activationPage.waitForLoadState('domcontentloaded');

  await activationPage
    .getByRole('button', {name: 'Activate toolbar', exact: true})
    .click();

  const result = await waitForActivation(activationPage);
  await activationPage.close();
  return result;
}

if (shouldRunOptional) {
  test.describe('Optional Host Permissions', () => {
    test('allow flow persists across navigation', async ({
      page,
      context,
      extensionId,
      helpers,
    }) => {
      test.setTimeout(120000);
      await page.goto('https://example.com', {waitUntil: 'domcontentloaded'});

      const {status, debug} = await activateWithGesture(
        context,
        extensionId,
        page.url()
      );
      expect(status, JSON.stringify(debug)).toBe('done');

      await page.bringToFront();
      await helpers.waitForToolbar();

      await page.goto('https://example.com/?next=1', {
        waitUntil: 'domcontentloaded',
      });
      await helpers.waitForToolbar();
      expect(debug).toBeTruthy();
    });

    test('deny flow does not persist', async ({page, context, extensionId}) => {
      test.setTimeout(120000);
      await page.goto('https://www.iana.org/domains/reserved', {
        waitUntil: 'domcontentloaded',
      });

      const {status, debug} = await activateWithGesture(
        context,
        extensionId,
        page.url()
      );
      expect(status, JSON.stringify(debug)).toBe('error:permission-denied');
      expect(debug).toBeTruthy();
    });
  });
}
