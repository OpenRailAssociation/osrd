import rollingstockTranslation from '../public/locales/fr/rollingstock.json';

class PlaywrightCommonPage {
  readonly rollingstockTranslation: typeof rollingstockTranslation;

  constructor() {
    this.rollingstockTranslation = rollingstockTranslation;
  }

  getRollingstockTranslation(key: keyof typeof rollingstockTranslation) {
    return this.rollingstockTranslation[key];
  }
}

export default PlaywrightCommonPage;
