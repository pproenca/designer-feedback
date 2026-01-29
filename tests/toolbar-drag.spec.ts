import { test, expect } from './fixtures';
import './types';

test.describe('Toolbar Drag Behavior', () => {
  test.beforeEach(async ({ page, helpers, toolbarPage }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await helpers.activateToolbar();
    await toolbarPage.waitForToolbar();
  });

  test('toolbar can be dragged to a new position', async ({ page, toolbarPage }) => {
    const initialBounds = await toolbarPage.getBounds();
    expect(initialBounds).not.toBeNull();

    // Drag to the middle of the viewport
    const viewportSize = page.viewportSize();
    const targetX = viewportSize!.width / 2;
    const targetY = viewportSize!.height / 2;

    await toolbarPage.dragTo(targetX, targetY);

    const newBounds = await toolbarPage.getBounds();
    expect(newBounds).not.toBeNull();

    // Toolbar should have moved (position changed)
    expect(newBounds!.x).not.toBe(initialBounds!.x);
    expect(newBounds!.y).not.toBe(initialBounds!.y);
  });
});
