import { Page } from '../baseFixtures';
import rollingstockTranslation from '../../public/locales/fr/rollingstock.json';

class PlaywrightCommonPage {
  readonly rollingstockTranslation: typeof rollingstockTranslation;

  constructor(readonly page: Page) {
    this.rollingstockTranslation = rollingstockTranslation;
    this.page = page;
  }

  getRollingstockTranslation(key: keyof typeof rollingstockTranslation) {
    return this.rollingstockTranslation[key];
  }

  async setTag(tag: string) {
    await this.page.getByTestId('chips-input').fill(tag);
    await this.page.getByTestId('chips-input').press('Enter');
  }
}

export default PlaywrightCommonPage;
