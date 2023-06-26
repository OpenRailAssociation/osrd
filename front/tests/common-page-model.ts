import { Locator, Page } from '@playwright/test';
import rollingstockTranslation from '../public/locales/fr/rollingstock.json';

class PlaywrightCommonPage {
  readonly rollingstockTranslation: typeof rollingstockTranslation;

  readonly getToastSNCF: Locator;

  constructor(readonly page: Page) {
    this.rollingstockTranslation = rollingstockTranslation;
    this.getToastSNCF = page.getByTestId('toast-SNCF');
  }

  getRollingstockTranslation(key: keyof typeof rollingstockTranslation) {
    return this.rollingstockTranslation[key];
  }

  checkToastSNCFVisible() {
    expect(this.getToastSNCF).toBeVisible();
  }

  async checkToastSNCF(text: string | RegExp) {
    await expect(this.getToastSNCF).toHaveText(text);
  }
}

export default PlaywrightCommonPage;
