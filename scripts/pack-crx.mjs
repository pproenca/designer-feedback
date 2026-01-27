import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const manifestPath = resolve(distDir, 'manifest.json');
const outputCrx = resolve(distDir, 'designer-feedback.crx');

function runBuild() {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['run', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error('Build failed; cannot pack CRX.');
  }
}

function findChromeExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const binCandidates = ['google-chrome', 'chrome', 'chromium'];
  for (const bin of binCandidates) {
    try {
      const resolved = execFileSync('which', [bin], { encoding: 'utf8' }).trim();
      if (resolved) return resolved;
    } catch {
      // ignore and keep trying
    }
  }

  throw new Error(
    'Chrome executable not found. Set CHROME_PATH to your Chrome binary.'
  );
}

function readKeyFromOp(opRef) {
  try {
    return execFileSync('op', ['read', opRef], { encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error(
      'Failed to read the private key from 1Password. Make sure `op` is installed and you are signed in.'
    );
  }
}

async function getKeyPath() {
  if (process.env.CRX_KEY_PATH && existsSync(process.env.CRX_KEY_PATH)) {
    return { path: process.env.CRX_KEY_PATH, temporary: false };
  }

  const opRef =
    process.env.CRX_KEY_OP ??
    'op://Private/chrome-extension-key/private key';
  const key = process.env.CRX_PRIVATE_KEY ?? readKeyFromOp(opRef);
  const tempPath = join(tmpdir(), `designer-feedback-key-${process.pid}.pem`);
  await fs.writeFile(tempPath, `${key}\n`, { mode: 0o600 });
  return { path: tempPath, temporary: true };
}

async function packExtension() {
  runBuild();

  if (!existsSync(manifestPath)) {
    throw new Error('Build did not produce dist/manifest.json.');
  }

  const chromePath = findChromeExecutable();
  const { path: keyPath, temporary } = await getKeyPath();

  try {
    execFileSync(chromePath, [
      `--pack-extension=${distDir}`,
      `--pack-extension-key=${keyPath}`,
    ], { stdio: 'inherit' });
  } finally {
    if (temporary) {
      try {
        await fs.unlink(keyPath);
      } catch {
        // ignore cleanup failures
      }
    }
  }

  const generatedCrx = resolve(rootDir, 'dist.crx');
  if (!existsSync(generatedCrx)) {
    throw new Error('Chrome did not produce dist.crx.');
  }

  try {
    await fs.unlink(outputCrx);
  } catch {
    // ignore if it does not exist
  }

  await fs.rename(generatedCrx, outputCrx);
  console.log(`CRX ready: ${outputCrx}`);
}

packExtension().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
