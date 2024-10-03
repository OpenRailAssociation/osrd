import { expect, type Locator, type Page } from '@playwright/test';

class BasePage {
  public page: Page;

  private backToHomePageButton: Locator;

  protected viteOverlay: Locator;

  readonly lastToast: Locator;

  constructor(page: Page) {
    this.page = page;

    this.backToHomePageButton = page.locator('.mastheader-logo');
    this.viteOverlay = page.locator('vite-plugin-checker-error-overlay');
    this.lastToast = page.getByTestId('toast-SNCF').last();
  }

  // Completely remove VITE button & sign
  async removeViteOverlay() {
    if ((await this.viteOverlay.count()) > 0) {
      await this.viteOverlay.evaluate((node) => node.setAttribute('style', 'display:none;'));
    }
  }

  async backToHomePage() {
    await this.backToHomePageButton.click();
  }

  async checkLastToastBody(text: string | RegExp) {
    await expect(this.lastToast.locator('.toast-body')).toHaveText(text);
  }

  async checkLastToastTitle(text: string | RegExp) {
    await expect(this.lastToast.getByTestId('toast-SNCF-title')).toHaveText(text);
  }

  async clickBtnByName(name: string) {
    await this.page.getByRole('button', { name }).click();
  }
}
export default BasePage;
