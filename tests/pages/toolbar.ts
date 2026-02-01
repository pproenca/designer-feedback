import {type Page, expect} from '@playwright/test';

/**
 * Page object for the Designer Feedback toolbar
 * Provides methods for interacting with the toolbar in E2E tests
 */
export class ToolbarPage {
  constructor(private readonly page: Page) {}

  // ============================================================================
  // Locators
  // ============================================================================

  /** Get the toolbar shadow root container */
  getToolbarRoot() {
    return this.page.locator('designer-feedback-root');
  }

  /** Get the toolbar container element */
  getToolbarContainer() {
    return this.page.locator('[data-toolbar]');
  }

  /** Get the Add annotation button */
  getAddButton() {
    return this.page.getByRole('button', {name: 'Add annotation', exact: true});
  }

  /** Get the Export feedback button */
  getExportButton() {
    return this.page.getByRole('button', {
      name: 'Export feedback',
      exact: true,
    });
  }

  /** Get a category button by name */
  getCategoryButton(category: 'Bug' | 'Question' | 'Suggestion') {
    return this.page.getByRole('button', {name: category, exact: true});
  }

  /** Get the annotation popup */
  getAnnotationPopup() {
    return this.page.locator('[data-annotation-popup]');
  }

  /** Get all annotation markers */
  getAnnotationMarkers() {
    return this.page.locator('[data-annotation-marker]');
  }

  /** Get the minimize button */
  getMinimizeButton() {
    return this.page.getByRole('button', {
      name: 'Minimize toolbar',
      exact: true,
    });
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /** Wait for the toolbar to be visible */
  async waitForToolbar() {
    await expect(this.getToolbarRoot()).toBeAttached({timeout: 10000});
    await expect(this.getToolbarContainer()).toBeVisible({timeout: 10000});
  }

  /** Click the Add annotation button */
  async clickAddAnnotation() {
    await this.getAddButton().click();
  }

  /** Select a category from the category panel */
  async selectCategory(category: 'Bug' | 'Question' | 'Suggestion') {
    await this.getCategoryButton(category).click();
  }

  /** Wait for add mode (crosshair cursor) */
  async waitForAddMode() {
    await expect(this.page.locator('body').first()).toHaveClass(
      /designer-feedback-add-mode/
    );
  }

  /** Click an element on the page to place annotation */
  async clickElement(locator: ReturnType<Page['locator']>) {
    await locator.click();
  }

  /** Fill the comment input in the annotation popup */
  async fillComment(comment: string) {
    const popup = this.getAnnotationPopup();
    await popup.getByPlaceholder('What should change?').fill(comment);
  }

  /** Submit the annotation */
  async submitAnnotation() {
    const popup = this.getAnnotationPopup();
    await popup.getByRole('button', {name: 'Add'}).click();
  }

  /**
   * Create an annotation with the full flow:
   * 1. Click Add annotation
   * 2. Select category
   * 3. Click target element
   * 4. Fill comment
   * 5. Submit
   */
  async createAnnotation(
    comment: string,
    category: 'Bug' | 'Question' | 'Suggestion',
    targetLocator: ReturnType<Page['locator']>
  ) {
    await this.clickAddAnnotation();
    await this.selectCategory(category);
    await this.waitForAddMode();
    await this.clickElement(targetLocator);

    const popup = this.getAnnotationPopup();
    await expect(popup).toBeVisible();
    await this.fillComment(comment);
    await this.submitAnnotation();
    await expect(this.getAnnotationMarkers()).toHaveCount(1);
  }

  /** Open the export modal */
  async openExportModal() {
    await this.getExportButton().click();
  }

  /** Minimize the toolbar */
  async minimizeToolbar() {
    const minimizeButton = this.getMinimizeButton();
    if (await minimizeButton.isVisible()) {
      await minimizeButton.click();
      await expect(minimizeButton).toBeHidden();
    }
  }

  /** Expand the toolbar from minimized state */
  async expandToolbar() {
    await this.getToolbarContainer().click();
    await expect(this.getAddButton()).toBeVisible();
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /** Get the count of annotations on the page */
  async getAnnotationCount() {
    return this.getAnnotationMarkers().count();
  }

  /** Get the bounding box of the toolbar */
  async getBounds() {
    return this.getToolbarContainer().boundingBox();
  }

  /** Check if toolbar is expanded */
  async isExpanded() {
    return this.getAddButton().isVisible();
  }

  /** Check if in add mode */
  async isInAddMode() {
    const body = this.page.locator('body').first();
    const className = await body.getAttribute('class');
    return className?.includes('designer-feedback-add-mode') ?? false;
  }

  // ============================================================================
  // Drag Operations
  // ============================================================================

  /**
   * Drag the toolbar to a specific position
   * Minimizes toolbar first to avoid button clicks during drag
   */
  async dragTo(x: number, y: number) {
    // Minimize to avoid hitting buttons during drag
    await this.minimizeToolbar();

    const bounds = await this.getBounds();
    if (!bounds) throw new Error('Toolbar not found');

    const startX = bounds.x + bounds.width / 2;
    const startY = bounds.y + bounds.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(x, y, {steps: 20});
    await this.page.mouse.up();

    // Expand toolbar after drag
    await this.expandToolbar();
  }
}
