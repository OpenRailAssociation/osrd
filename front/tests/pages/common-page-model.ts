import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import rollingstockTranslation from '../../public/locales/fr/rollingstock.json';
import BasePage from './base-page';

class PlaywrightCommonPage extends BasePage {
  readonly rollingstockTranslation: typeof rollingstockTranslation;

  readonly getToastSNCF: Locator;

  constructor(readonly page: Page) {
    super(page);
    this.rollingstockTranslation = rollingstockTranslation;
    this.getToastSNCF = page.getByTestId('toast-SNCF');
  }

  getRollingstockTranslation(key: keyof typeof rollingstockTranslation) {
    return this.rollingstockTranslation[key];
  }

  async setTag(tag: string) {
    await this.page.getByTestId('chips-input').fill(tag);
    await this.page.getByTestId('chips-input').press('Enter');
  }

  async checkToastSNCFBody(text: string | RegExp) {
    await expect(this.getToastSNCF.locator('.toast-body')).toHaveText(text);
  }

  async checkToastSNCFTitle(text: string | RegExp) {
    await expect(this.getToastSNCF.locator('strong')).toHaveText(text);
  }
}

export default PlaywrightCommonPage;
