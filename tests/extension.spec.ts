import { test, expect } from './fixtures';
import './types';

test.describe('Annotation Workflow', () => {
  test.beforeEach(async ({ page, helpers, toolbarPage }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await helpers.activateToolbar();
    await toolbarPage.waitForToolbar();
  });

  test('toolbar activates and shows controls', async ({ toolbarPage }) => {
    await expect(toolbarPage.getAddButton()).toBeVisible();
  });

  test('create annotation and open export modal', async ({ page, toolbarPage, exportModal }) => {
    const comment = 'Tighten spacing above the headline.';
    const heading = page.getByRole('heading', { name: 'Example Domain' });
    await toolbarPage.createAnnotation(comment, 'Bug', heading);

    await expect(toolbarPage.getExportButton()).toBeEnabled();
    await toolbarPage.openExportModal();

    await exportModal.waitForOpen();
    await expect(exportModal.getHeading()).toBeVisible();
    await expect(exportModal.getAnnotationText(comment)).toBeVisible();
    await exportModal.close();
  });

  test('delete annotation removes marker', async ({ page, toolbarPage }) => {
    const comment = 'Update the hero copy.';
    const heading = page.getByRole('heading', { name: 'Example Domain' });
    await toolbarPage.createAnnotation(comment, 'Suggestion', heading);

    await toolbarPage.getAnnotationMarkers().first().click();
    const popup = toolbarPage.getAnnotationPopup();
    await expect(popup.getByText(comment)).toBeVisible();
    await popup.getByRole('button', { name: 'Delete' }).click();

    await expect(toolbarPage.getAnnotationMarkers()).toHaveCount(0);
    await expect(toolbarPage.getExportButton()).toBeDisabled();
  });
});
