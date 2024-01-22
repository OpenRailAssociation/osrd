/**
 * tests setup for the infra editor page
 */

/* eslint-disable import/prefer-default-export */
import { Locator, Page } from '@playwright/test';

export class PlaywrightEditorPage {
  // The current page object
  readonly page: Page;

  readonly getErrorBox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.getErrorBox = page.locator('.error-box');
  }

  // Navigate to the infra page
  async goToEditorPage() {
    await this.page.goto('/editor');
  }
}
