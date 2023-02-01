/* eslint-disable import/prefer-default-export */
import { expect, Locator, Page } from '@playwright/test';
import infraManagement from '../public/locales/fr/infraManagement.json';

export class PlaywrightSTDCMPage {
  // The current page object
  readonly page: Page;

  // Locator for infrastructure button
  readonly getInfraSelector: Locator;

  // Locator for infrastructure list items
  readonly getInfraListItems: Locator;

  readonly getBody: Locator;

  readonly getInfraCount: Locator;

  readonly translation: typeof infraManagement;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.getInfraSelector = page.getByTestId('infraselector-button');
    this.getInfraListItems = page.locator('.infraslist-item-choice');
    this.getInfraCount = page.locator('.infras-count');
    this.getBody = page.locator('body');
    this.translation = infraManagement;
  }

  // Open infrastructures selector
  async openInfraSelector() {
    await this.getInfraSelector.click();
  }

  // Check the absence of the class 'modal-open' in the body
  async getModalClose() {
    await expect(this.getBody).not.toHaveClass('modal-open');
  }

  // Check the presence of the class 'modal-open' in the body
  async getModalOpen() {
    await expect(this.getBody).toHaveClass('modal-open');
  }

  async checkNumberOfInfra(numberOfInfra: number) {
    const infrasFoundTranslation = this.getTranslations('infrasFound');
    await expect(this.getInfraCount).toContainText(`${numberOfInfra} ${infrasFoundTranslation}`);
  }

  getTranslations(key: keyof typeof infraManagement) {
    return this.translation[key];
  }
}
