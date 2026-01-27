/**
 * Promotional Image Generator
 *
 * Renders Chrome Web Store promotional images using Puppeteer.
 * Shows an abstract webapp mockup with annotation markers.
 *
 * Usage: npx tsx scripts/render-promo.ts
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMO_DIR = path.resolve(__dirname, '../promo');

// Design tokens
const COLORS = {
  bg: '#1a1a1a',
  mockupBg: '#232323',
  sidebar: '#2a2a2a',
  header: '#2a2a2a',
  card: '#2d2d2d',
  border: 'rgba(255, 255, 255, 0.06)',
  // Marker colors from the app
  bug: '#FF3B30',
  suggestion: '#3C82F7',
  question: '#FFD60A',
};

// Marker component (matches app style)
const marker = (number: number, color: string, top: string, left: string, size = 28, fontSize = 14) => `
  <div style="
    position: absolute;
    top: ${top};
    left: ${left};
    width: ${size}px;
    height: ${size}px;
    background: ${color};
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${fontSize}px;
    font-weight: 600;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    transform: translate(-50%, -50%);
  ">${number}</div>
`;

// Small promo (440x280)
const smallPromoHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 440px;
      height: 280px;
      background: ${COLORS.bg};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .mockup {
      position: relative;
      width: 380px;
      height: 220px;
      background: ${COLORS.mockupBg};
      border-radius: 12px;
      border: 1px solid ${COLORS.border};
      display: flex;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    .sidebar {
      width: 72px;
      background: ${COLORS.sidebar};
      border-right: 1px solid ${COLORS.border};
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .nav-item {
      height: 10px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
    }
    .nav-item.active {
      background: rgba(60, 130, 247, 0.3);
    }
    .main {
      flex: 1;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .header {
      height: 32px;
      background: ${COLORS.header};
      border-radius: 6px;
      border: 1px solid ${COLORS.border};
    }
    .content {
      flex: 1;
      display: flex;
      gap: 10px;
    }
    .card {
      flex: 1;
      background: ${COLORS.card};
      border-radius: 8px;
      border: 1px solid ${COLORS.border};
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .card-line {
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 3px;
    }
    .card-line.short { width: 60%; }
    .card-line.medium { width: 80%; }
  </style>
</head>
<body>
  <div class="mockup">
    <div class="sidebar">
      <div class="nav-item active"></div>
      <div class="nav-item"></div>
      <div class="nav-item"></div>
      <div class="nav-item"></div>
    </div>
    <div class="main">
      <div class="header"></div>
      <div class="content">
        <div class="card">
          <div class="card-line medium"></div>
          <div class="card-line short"></div>
          <div class="card-line"></div>
        </div>
        <div class="card">
          <div class="card-line short"></div>
          <div class="card-line medium"></div>
          <div class="card-line"></div>
        </div>
      </div>
    </div>
    ${marker(1, COLORS.bug, '52px', '200px')}
    ${marker(2, COLORS.suggestion, '130px', '320px')}
    ${marker(3, COLORS.question, '160px', '52px')}
  </div>
</body>
</html>
`;

// Marquee promo (1400x560) - same concept, more breathing room
const marqueePromoHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1400px;
      height: 560px;
      background: ${COLORS.bg};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .mockup {
      position: relative;
      width: 1100px;
      height: 440px;
      background: ${COLORS.mockupBg};
      border-radius: 16px;
      border: 1px solid ${COLORS.border};
      display: flex;
      overflow: hidden;
      box-shadow: 0 16px 64px rgba(0, 0, 0, 0.5);
    }
    .sidebar {
      width: 180px;
      background: ${COLORS.sidebar};
      border-right: 1px solid ${COLORS.border};
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .nav-item {
      height: 16px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 6px;
    }
    .nav-item.active {
      background: rgba(60, 130, 247, 0.3);
    }
    .main {
      flex: 1;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .header {
      height: 56px;
      background: ${COLORS.header};
      border-radius: 10px;
      border: 1px solid ${COLORS.border};
    }
    .content {
      flex: 1;
      display: flex;
      gap: 20px;
    }
    .card {
      flex: 1;
      background: ${COLORS.card};
      border-radius: 12px;
      border: 1px solid ${COLORS.border};
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .card-line {
      height: 14px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 5px;
    }
    .card-line.short { width: 60%; }
    .card-line.medium { width: 80%; }
  </style>
</head>
<body>
  <div class="mockup">
    <div class="sidebar">
      <div class="nav-item active"></div>
      <div class="nav-item"></div>
      <div class="nav-item"></div>
      <div class="nav-item"></div>
      <div class="nav-item"></div>
    </div>
    <div class="main">
      <div class="header"></div>
      <div class="content">
        <div class="card">
          <div class="card-line medium"></div>
          <div class="card-line short"></div>
          <div class="card-line"></div>
          <div class="card-line medium"></div>
        </div>
        <div class="card">
          <div class="card-line short"></div>
          <div class="card-line medium"></div>
          <div class="card-line"></div>
          <div class="card-line short"></div>
        </div>
        <div class="card">
          <div class="card-line medium"></div>
          <div class="card-line"></div>
          <div class="card-line short"></div>
          <div class="card-line medium"></div>
        </div>
      </div>
    </div>
    ${marker(1, COLORS.bug, '100px', '480px', 36, 18)}
    ${marker(2, COLORS.suggestion, '280px', '850px', 36, 18)}
    ${marker(3, COLORS.question, '320px', '130px', 36, 18)}
  </div>
</body>
</html>
`;

interface PromoConfig {
  name: string;
  width: number;
  height: number;
  html: string;
}

const PROMOS: PromoConfig[] = [
  { name: 'promo-small', width: 440, height: 280, html: smallPromoHTML },
  { name: 'promo-marquee', width: 1400, height: 560, html: marqueePromoHTML },
];

async function generatePromos() {
  // Ensure promo directory exists
  if (!fs.existsSync(PROMO_DIR)) {
    fs.mkdirSync(PROMO_DIR, { recursive: true });
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });

  for (const promo of PROMOS) {
    console.log(`Generating ${promo.name} (${promo.width}x${promo.height})...`);

    const page = await browser.newPage();
    await page.setViewport({
      width: promo.width,
      height: promo.height,
      deviceScaleFactor: 1,
    });

    await page.setContent(promo.html, { waitUntil: 'networkidle0' });

    const outputPath = path.join(PROMO_DIR, `${promo.name}.png`);
    await page.screenshot({ type: 'png', path: outputPath });

    console.log(`Generated: ${outputPath}`);
    await page.close();
  }

  await browser.close();
  console.log('Done!');
}

generatePromos().catch((err) => {
  console.error('Error generating promo images:', err);
  process.exit(1);
});
