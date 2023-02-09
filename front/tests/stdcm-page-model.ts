/* eslint-disable import/prefer-default-export */
import { Locator, Page } from '@playwright/test';
import infraManagement from '../public/locales/fr/infraManagement.json';

export class PlaywrightSTDCMPage {
  readonly page: Page;

  readonly getBody: Locator;

  readonly translation: typeof infraManagement;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.getBody = page.locator('body');
    this.translation = infraManagement;
  }

  getTranslations(key: keyof typeof infraManagement) {
    return this.translation[key];
  }
}
