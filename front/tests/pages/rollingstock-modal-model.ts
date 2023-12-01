import { Locator, Page, expect } from '../baseFixtures';
import PlaywrightCommonPage from './common-page-model';

class PlaywrightRollingstockModalPage {
  readonly page: Page;

  readonly playwrightCommonPage: PlaywrightCommonPage;

  readonly getRollingStockSelector: Locator;

  readonly getRollingstockModal: Locator;

  readonly getResultsFound: Locator;

  readonly getRollingStockSearch: Locator;

  readonly getRollingStockSearchFilter: Locator;

  readonly getRollingstockMiniCard: Locator;

  readonly getRollingstockSpanNames: Locator;

  readonly getElectricalCheckbox: Locator;

  constructor(page: Page) {
    this.page = page;
    this.playwrightCommonPage = new PlaywrightCommonPage(page);
    this.getRollingStockSelector = page.getByTestId('rollingstock-selector-minicard');
    this.getRollingstockModal = page.locator('.modal-dialog');
    this.getResultsFound = page.locator('.modal-dialog').locator('small').first();
    this.getRollingStockSearch = this.getRollingstockModal.locator('#searchfilter');
    this.getRollingStockSearchFilter = page.locator('.rollingstock-search-filters');
    this.getRollingstockMiniCard = page.locator('.rollingstock-minicard');
    this.getRollingstockSpanNames = page.locator('.rollingstock-minicard-name');
    this.getElectricalCheckbox = this.getRollingstockModal.locator('label').filter({
      hasText: this.playwrightCommonPage.getRollingstockTranslation('electric') as string,
    });
  }

  async openRollingstockModal() {
    await this.getRollingStockSelector.click();
  }

  async checkNumberOfRollingstockFound(expectedRollingstock: string) {
    await expect(this.getResultsFound).toHaveText(
      `${expectedRollingstock} ${this.playwrightCommonPage.getRollingstockTranslation(
        'resultsFound'
      )}`
    );
  }

  async searchRollingstock(rollingstockName: string) {
    await this.getRollingStockSearch.fill(rollingstockName);
  }

  getRollingstockCardByTestID(rollingstockTestID: string) {
    return this.getRollingstockModal.getByTestId(rollingstockTestID);
  }

  getRollingStockMiniCardInfo() {
    return this.getRollingstockMiniCard.locator('.rollingstock-info');
  }

  getRollingStockInfoComfort() {
    return this.getRollingstockMiniCard.locator('.rollingstock-info-comfort');
  }
}

export default PlaywrightRollingstockModalPage;
