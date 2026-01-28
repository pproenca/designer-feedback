import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

test('manifest has minimal permissions for 1-click activation', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const manifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Verify no optional_host_permissions
  expect(manifest.optional_host_permissions).toBeUndefined();

  // Verify required permissions
  expect(manifest.permissions).toContain('activeTab');
  expect(manifest.permissions).toContain('scripting');
  expect(manifest.permissions).toContain('storage');

  // Verify no popup (1-click activation via icon)
  expect(manifest.action?.default_popup).toBeUndefined();
  expect(manifest.action?.default_title).toBe('Click to activate Designer Feedback');
});

test('web accessible resources are scoped correctly', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const manifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const webResources = manifest.web_accessible_resources ?? [];

  expect(webResources).toHaveLength(1);

  const flattenedResources = webResources.flatMap((entry: { resources?: string[] }) =>
    entry?.resources ?? []
  );

  // Should have content script and assets
  expect(flattenedResources).toContain('assets/content-*.js');
  expect(flattenedResources).toContain('assets/index-*.js');
  expect(flattenedResources).toContain('assets/style-*.css');
  expect(flattenedResources).toContain('assets/*.woff2');

  // Should NOT have wildcards that expose everything
  expect(flattenedResources).not.toContain('assets/*.js');
  expect(flattenedResources).not.toContain('assets/*.css');
});
