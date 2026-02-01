/**
 * Icon Generator Script
 *
 * Renders the app icon using Puppeteer and resizes to required sizes using Sharp.
 * Uses Lucide's MessageCirclePlus icon on a blue rounded-square background.
 *
 * Usage: npx tsx scripts/render-icons.ts
 */

import puppeteer from 'puppeteer';
import sharp from 'sharp';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '../icons');

// Design tokens from the app
const BLUE = '#3C82F7';
const WHITE = '#FFFFFF';

// Lucide MessageCirclePlus icon SVG path (from lucide-icons)
// https://github.com/lucide-icons/lucide/blob/main/icons/message-circle-plus.svg
const MESSAGE_CIRCLE_PLUS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="${WHITE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>
  <path d="M8 12h8"/>
  <path d="M12 8v8"/>
</svg>
`;

// HTML template for the icon
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 128px;
      height: 128px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
    }
    .icon-bg {
      width: 96px;
      height: 96px;
      background: ${BLUE};
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div class="icon-bg">
    ${MESSAGE_CIRCLE_PLUS_SVG}
  </div>
</body>
</html>
`;

const SIZES = [128, 48, 32, 16] as const;

async function generateIcons() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();

  // Set viewport to exact icon size
  await page.setViewport({width: 128, height: 128, deviceScaleFactor: 1});

  // Load the HTML template
  await page.setContent(HTML_TEMPLATE, {waitUntil: 'networkidle0'});

  // Take screenshot at 128px
  console.log('Capturing 128px icon...');
  const screenshot = await page.screenshot({
    type: 'png',
    omitBackground: true,
  });

  await browser.close();

  // Save 128px and resize to other sizes
  for (const size of SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon${size}.png`);

    if (size === 128) {
      await sharp(screenshot).toFile(outputPath);
    } else {
      await sharp(screenshot)
        .resize(size, size, {kernel: sharp.kernel.lanczos3})
        .toFile(outputPath);
    }

    console.log(`Generated: ${outputPath}`);
  }

  console.log('Done!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
