import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Static analysis tests for mount.tsx shadow DOM configuration.
 *
 * These tests verify the source code configuration to prevent regressions
 * in the shadow DOM setup that caused CI build interaction failures.
 *
 * Background:
 * - `isolateEvents: true` called stopPropagation on keyboard events, breaking
 *   Escape/Enter shortcuts in the extension UI
 * - Production uses `mode: 'closed'` for security (page scripts can't access
 *   extension internals)
 * - E2E tests use `VITE_DF_E2E=1` to set `mode: 'open'` so Playwright can
 *   access shadow DOM elements
 */
describe('mount.tsx shadow DOM configuration', () => {
  const mountSource = fs.readFileSync(
    path.join(__dirname, 'mount.tsx'),
    'utf-8'
  );

  it('uses closed shadow DOM mode in production for security', () => {
    // Production mode should be 'closed' to prevent page scripts from
    // accessing extension internals via shadowRoot property
    expect(mountSource).toMatch(/mode:\s*isE2E\s*\?\s*['"]open['"]\s*:\s*['"]closed['"]/);
  });

  it('does not use isolateEvents (prevents keyboard event blocking)', () => {
    // isolateEvents: true blocks keyboard events from reaching document listeners
    // which breaks Escape/Enter shortcuts in the toolbar UI
    // Check that isolateEvents is not used as a config option (not just mentioned in comments)
    expect(mountSource).not.toMatch(/isolateEvents\s*:/);
  });

  it('has E2E toggle for shadow DOM mode (required for Playwright)', () => {
    // E2E tests need open shadow DOM because Playwright cannot pierce closed
    // shadow roots (extension runs in isolated world, not affected by addInitScript)
    expect(mountSource).toMatch(/VITE_DF_E2E/);
  });
});
