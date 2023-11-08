import { expect, Locator, Page } from '@playwright/test';
import rollingstockTranslation from '../../public/locales/fr/rollingstock.json';

class PlaywrightCommonPage {
  readonly rollingstockTranslation: typeof rollingstockTranslation;

  readonly getToastSNCF: Locator;

  constructor(readonly page: Page) {
    this.rollingstockTranslation = rollingstockTranslation;
    this.page = page;
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
