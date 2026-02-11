import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const bundlePath = path.join(
  repoRoot,
  '.output',
  'chrome-mv3',
  'content-scripts',
  'content.js'
);
const maxBytes = Number(process.env.MAX_CONTENT_SCRIPT_BYTES ?? 420 * 1024);

if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
  throw new Error(`Invalid MAX_CONTENT_SCRIPT_BYTES value: ${process.env.MAX_CONTENT_SCRIPT_BYTES}`);
}

if (!fs.existsSync(bundlePath)) {
  throw new Error(`Missing bundle file: ${bundlePath}. Run "npm run build" first.`);
}

const fileSizeBytes = fs.statSync(bundlePath).size;
const maxSizeKb = (maxBytes / 1024).toFixed(2);
const fileSizeKb = (fileSizeBytes / 1024).toFixed(2);

if (fileSizeBytes > maxBytes) {
  throw new Error(
    `Content script bundle too large: ${fileSizeKb} KiB > ${maxSizeKb} KiB (${bundlePath})`
  );
}

console.log(`Content script bundle size OK: ${fileSizeKb} KiB <= ${maxSizeKb} KiB`);
