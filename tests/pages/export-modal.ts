import {type Page, expect} from '@playwright/test';

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
    return this.page.getByRole('dialog', {name: 'Export feedback'});
  }

  /** Get the export heading */
  getHeading() {
    return this.getDialog().getByRole('heading', {name: 'Export Feedback'});
  }

  /** Get the close button (the visible X button, not the backdrop) */
  getCloseButton() {
    return this.getDialog().getByLabel('Close export dialog');
  }

  /** Get a format option label by text */
  getFormatOption(label: 'Copy Notes' | 'Download Snapshot') {
    return this.getDialog().locator('label').filter({hasText: label}).first();
  }

  /** Get the primary export action button */
  getExportButton() {
    return this.getDialog().getByRole('button', {name: 'Export feedback'});
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /** Wait for the export modal to open */
  async waitForOpen() {
    await expect(this.getDialog()).toBeVisible({timeout: 5000});
  }

  /** Close the export modal */
  async close() {
    await this.getCloseButton().click();
    await expect(this.getDialog()).toBeHidden();
  }

  /** Select a format option */
  async selectFormat(label: 'Copy Notes' | 'Download Snapshot') {
    await this.getFormatOption(label).click();
  }

  /** Click the primary export action */
  async clickExport() {
    await this.getExportButton().click();
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /** Check if the modal is open */
  async isOpen() {
    return this.getDialog().isVisible();
  }

  /** Check if the export action is available */
  async canExport() {
    return this.getExportButton().isEnabled();
  }
}
