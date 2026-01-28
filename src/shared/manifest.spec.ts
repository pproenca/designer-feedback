import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, '../../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

describe('manifest security', () => {
  it('has minimal permissions for 1-click activation', () => {
    expect(manifest.optional_host_permissions).toBeUndefined();

    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
    expect(manifest.permissions).toContain('storage');

    expect(manifest.action?.default_popup).toBeUndefined();
    expect(manifest.action?.default_title).toBe('Click to activate Designer Feedback');
  });

  it('scopes web accessible resources correctly', () => {
    const webResources = manifest.web_accessible_resources ?? [];

    expect(webResources).toHaveLength(1);

    const flattenedResources = webResources.flatMap((entry: { resources?: string[] }) =>
      entry?.resources ?? []
    );

    expect(flattenedResources).toContain('assets/content-*.js');
    expect(flattenedResources).toContain('assets/index-*.js');
    expect(flattenedResources).toContain('assets/settings-*.js');
    expect(flattenedResources).toContain('assets/style-*.css');
    expect(flattenedResources).toContain('assets/*.woff2');

    expect(flattenedResources).not.toContain('assets/*.js');
    expect(flattenedResources).not.toContain('assets/*.css');
  });
});
