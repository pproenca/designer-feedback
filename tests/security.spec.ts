import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

test('manifest does not expose web accessible resources', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const manifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const webResources = manifest.web_accessible_resources ?? [];

  expect(webResources).toHaveLength(1);
  expect(webResources[0]).toEqual(
    expect.objectContaining({
      matches: ['http://*/*', 'https://*/*'],
      resources: expect.arrayContaining([
        'assets/index-*.js',
        'assets/client-*.js',
        'assets/site-access-*.js',
        'assets/*.woff2',
      ]),
    })
  );

  const flattenedResources = webResources.flatMap((entry: { resources?: string[] }) =>
    entry?.resources ?? []
  );
  expect(flattenedResources).not.toContain('assets/*.js');
  expect(flattenedResources).not.toContain('assets/*.css');
});
