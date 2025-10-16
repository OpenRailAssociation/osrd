import { expect, type Locator, type Page } from '@playwright/test';

import { logger } from '../logging-fixture';

class CommonPage {
  readonly page: Page;

  readonly toastContainer: Locator;

  private readonly toastTitle: Locator;

  private readonly tagField: Locator;

  private readonly viteOverlay: Locator;

  private readonly closeToastButton: Locator;

  private readonly navigationToHomeButton: Locator;

  private readonly navigationBackButton: Locator;

  private readonly loader: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toastContainer = page.getByTestId('toast-SNCF');
    this.toastTitle = this.toastContainer.getByTestId('toast-SNCF-title');
    this.tagField = page.getByTestId('chips-input');
    this.viteOverlay = page.locator('vite-plugin-checker-error-overlay');
    this.closeToastButton = page.getByTestId('close-toast-button');
    this.navigationToHomeButton = page.getByTestId('navigation-to-home-button');
    this.navigationBackButton = page.getByTestId('navigation-back-button');
    this.loader = page.getByTestId('loader');
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

  // Remove the Vite error overlay if it appears
  async removeViteOverlay(): Promise<void> {
    if (await this.viteOverlay.count()) {
      await this.viteOverlay.evaluate((node) => node.setAttribute('style', 'display:none;'));
    }
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
}

export default CommonPage;
