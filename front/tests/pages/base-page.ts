import { Locator, Page } from '@playwright/test';

export default class BasePage {
  public page: Page;

  private backToHomePageButton: Locator;

  protected viteOverlay: Locator;

  constructor(page: Page) {
    this.page = page;

    this.backToHomePageButton = page.locator('.mastheader-logo');
    this.viteOverlay = page.locator('vite-plugin-checker-error-overlay');
  }

  // Completly remove VITE button & sign
  async removeViteOverlay() {
    if ((await this.viteOverlay.count()) > 0) {
      await this.viteOverlay.evaluate((node) => node.setAttribute('style', 'display:none;'));
    }
  }

  async backToHomePage() {
    await this.backToHomePageButton.click();
  }
}
