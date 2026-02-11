import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {Builder} from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';

const require = createRequire(import.meta.url);
const geckodriver = require('geckodriver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');

function run(command) {
  execSync(command, {
    cwd: repoRoot,
    env: {...process.env, VITE_DF_E2E: '1'},
    stdio: 'inherit',
  });
}

function findLatestZip(outputDir) {
  const zips = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.zip')) {
        const stat = fs.statSync(entryPath);
        zips.push({path: entryPath, mtimeMs: stat.mtimeMs});
      }
    }
  };

  if (fs.existsSync(outputDir)) {
    walk(outputDir);
  }

  if (zips.length === 0) {
    return null;
  }

  zips.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return zips[0].path;
}

async function waitFor(driver, predicate, timeoutMs, description) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await predicate()) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function resolveFirefoxBinary() {
  if (process.env.FIREFOX_BINARY) {
    return process.env.FIREFOX_BINARY;
  }

  const candidates = [
    '/Applications/Firefox.app/Contents/MacOS/firefox',
    '/Applications/Firefox Nightly.app/Contents/MacOS/firefox',
    '/Applications/Firefox Developer Edition.app/Contents/MacOS/firefox',
    '/usr/bin/firefox',
    '/usr/local/bin/firefox',
    '/opt/homebrew/bin/firefox',
    '/snap/bin/firefox',
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const playwright = require('playwright');
    const playwrightBinary = playwright.firefox?.executablePath?.();
    if (playwrightBinary && fs.existsSync(playwrightBinary)) {
      return playwrightBinary;
    }
  } catch {
    // ignore
  }

  try {
    const resolved = execSync('command -v firefox', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  } catch {
    // ignore
  }

  return null;
}

async function main() {
  run('npx wxt zip -b firefox --mv3');

  const zipPath = findLatestZip(path.join(repoRoot, '.output'));
  if (!zipPath) {
    throw new Error('Firefox zip not found in .output. Run wxt zip first.');
  }

  const geckoPath = await geckodriver.download();
  if (!geckoPath) {
    throw new Error('geckodriver download failed.');
  }

  const firefoxBinary = resolveFirefoxBinary();
  if (!firefoxBinary) {
    throw new Error(
      'Firefox binary not found. Set FIREFOX_BINARY to your Firefox executable.'
    );
  }

  const options = new firefox.Options()
    .setBinary(firefoxBinary)
    .setPreference('xpinstall.signatures.required', false)
    .setPreference('extensions.autoDisableScopes', 0)
    .setPreference('extensions.enabledScopes', 15);

  const headless =
    process.env.FIREFOX_HEADLESS === '1' ||
    process.env.CI === 'true' ||
    process.env.CI === '1';
  if (headless) {
    options.addArguments('-headless');
  }

  const service = new firefox.ServiceBuilder(geckoPath);
  const driver = await new Builder()
    .forBrowser('firefox')
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    .build();

  try {
    const addonId = await driver.installAddon(zipPath, true);
    if (!addonId) {
      throw new Error('Firefox add-on installation failed.');
    }

    const targetUrl = 'https://example.com/';
    const activationUrl = `moz-extension://${addonId}/test-activate.html?target=${encodeURIComponent(
      targetUrl
    )}`;

    await driver.get(activationUrl);
    await waitFor(
      driver,
      async () => {
        const status = await driver.executeScript(
          'return window.__dfActivateStatus'
        );
        return (
          status === 'done' ||
          (typeof status === 'string' && status.startsWith('error:'))
        );
      },
      10000,
      'extension activation'
    );

    const status = await driver.executeScript(
      'return window.__dfActivateStatus'
    );
    if (status !== 'done') {
      throw new Error(`Activation failed: ${String(status)}`);
    }

    await driver.get(targetUrl);
    await waitFor(
      driver,
      async () =>
        await driver.executeScript(
          "return !!document.querySelector('designer-feedback-root')"
        ),
      10000,
      'toolbar mount'
    );

    console.log('Firefox E2E smoke test passed.');
  } finally {
    await driver.quit();
  }
}

await main();
