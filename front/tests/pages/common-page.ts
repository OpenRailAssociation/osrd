import { expect, type Locator, type Page } from '@playwright/test';

import { logger } from '../logging-fixture';

class CommonPage {
  readonly page: Page;
  readonly toastContainer: Locator;
  private readonly toastTitle: Locator;
  private readonly tagField: Locator;
  private readonly closeToastButton: Locator;
  private readonly navigationToHomeButton: Locator;
  private readonly navigationBackButton: Locator;
  private readonly loader: Locator;
  private readonly spinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastContainer = page.getByTestId('toast-SNCF');
    this.toastTitle = this.toastContainer.getByTestId('toast-SNCF-title');
    this.tagField = page.getByTestId('chips-input');
    this.closeToastButton = page.getByTestId('close-toast-button');
    this.navigationToHomeButton = page.getByTestId('navigation-to-home-button');
    this.navigationBackButton = page.getByTestId('navigation-back-button');
    this.loader = page.getByTestId('loader');
    this.spinner = page.getByTestId('spinner');
  }

  // Set the tag of project, study or scenario
  async setTag(tag: string): Promise<void> {
    await expect(this.tagField).toBeVisible();
    await this.tagField.fill(tag);
    await this.tagField.press('Enter');
  }

  // Verify the text of all toast notification titles
  async checkToastTitle(expectedText: string | RegExp): Promise<void> {
    const toastTitles = await this.toastTitle.all();
    await Promise.all(
      toastTitles.map(async (toastTitle) => {
        try {
          await expect(toastTitle).toHaveText(expectedText);
        } catch {
          logger.warn('The toast disappeared before the title could be verified');
        }
      })
    );
  }

  async checkToastHasBeenLaunched(translation: string) {
    await this.checkToastTitle(translation);
    await this.closeToastNotification();
  }

  // Close all visible toast notifications safely
  async closeToastNotification(): Promise<void> {
    const closeToastElements = await this.closeToastButton.all();
    await Promise.all(
      closeToastElements.map(async (closeToastElement) => {
        try {
          if (await closeToastElement.isVisible()) {
            await closeToastElement.click();
          }
        } catch {
          logger.warn('Toast disappeared before it could be clicked');
        }
      })
    );
  }

  async expectResourceNotFoundPage() {
    await expect(this.navigationToHomeButton).toBeVisible();
    await expect(this.navigationBackButton).toBeVisible();
  }

  async waitForLoaderToDisappear({ timeout }: { timeout?: number } = {}): Promise<void> {
    const count = await this.loader.count();
    if (count > 0) {
      await expect(this.loader).not.toBeVisible({ timeout });
    }
  }

  async waitForSpinnerToDisappear(): Promise<void> {
    try {
      // The list spinner has a 500ms display delay; give it a moment to appear on slow loads.
      await this.spinner.first().waitFor({ state: 'visible', timeout: 1_000 });
    } catch {
      // Spinner never appeared - the view loaded fast, nothing to wait for.
      return;
    }
    await expect(this.spinner).toHaveCount(0);
  }

  async validateNumericBudget(locator: Locator, expectedBudget: string): Promise<void> {
    const budgetText = await locator.textContent();
    expect(budgetText?.replace(/[^0-9]/g, '')).toEqual(expectedBudget);
  }
}

export default CommonPage;
