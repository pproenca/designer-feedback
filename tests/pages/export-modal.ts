import { type Page, expect } from '@playwright/test';

/**
 * Page object for the Export Modal
 * Provides methods for interacting with the export modal in E2E tests
 */
export class ExportModalPage {
  constructor(private readonly page: Page) {}

  // ============================================================================
  // Locators
  // ============================================================================

  /** Get the export dialog */
  getDialog() {
    return this.page.getByRole('dialog', { name: 'Export feedback' });
  }

  /** Get the export heading */
  getHeading() {
    return this.page.getByRole('heading', { name: 'Export Feedback' });
  }

  /** Get the close button (the visible X button, not the backdrop) */
  getCloseButton() {
    return this.getDialog().getByLabel('Close export dialog');
  }

  /** Get the Snapshot button */
  getSnapshotButton() {
    return this.page.getByRole('button', { name: 'Snapshot' });
  }

  /** Get annotation text in the export preview */
  getAnnotationText(comment: string) {
    return this.getDialog().getByText(comment);
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /** Wait for the export modal to open */
  async waitForOpen() {
    await expect(this.getDialog()).toBeVisible({ timeout: 5000 });
  }

  /** Close the export modal */
  async close() {
    await this.getCloseButton().click();
    await expect(this.getDialog()).toBeHidden();
  }

  /** Click the Snapshot button */
  async clickSnapshot() {
    await this.getSnapshotButton().click();
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /** Check if the modal is open */
  async isOpen() {
    return this.getDialog().isVisible();
  }

  /** Check if an annotation comment is shown in the export */
  async hasAnnotation(comment: string) {
    return this.getAnnotationText(comment).isVisible();
  }
}
