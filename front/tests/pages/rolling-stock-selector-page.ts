import { type Locator, type Page, expect } from '@playwright/test';

import BasePage from './base-page';
import rollingstockTranslation from '../../public/locales/fr/rollingstock.json';

const electricCheckboxTranslation = rollingstockTranslation.electric;

export default class RollingStockSelectorPage extends BasePage {
  readonly rollingStockSelectorButton: Locator;

  readonly rollingStockSelectorModal: Locator;

  readonly getResultsFound: Locator;

  private rollingStockList: Locator;

  readonly rollingStockListItem: Locator;

  readonly getRollingStockSearch: Locator;

  readonly getRollingStockSearchFilter: Locator;

  readonly rollingStockMiniCards: Locator;

  readonly getRollingstockSpanNames: Locator;

  readonly electricalCheckbox: Locator;

  constructor(page: Page) {
    super(page);
    this.rollingStockSelectorButton = page.getByTestId('rollingstock-selector');
    this.rollingStockSelectorModal = page.locator('.modal-dialog');

    this.rollingStockList = page.locator('.rollingstock-search-list');
    this.rollingStockListItem = page.locator('.rollingstock-container');

    this.getResultsFound = page.locator('.modal-dialog').locator('small').first();
    this.getRollingStockSearch = this.rollingStockSelectorModal.locator('#searchfilter');
    this.getRollingStockSearchFilter = page.locator('.rollingstock-search-filters');
    this.rollingStockMiniCards = page.locator('.rollingstock-selector-minicard');
    this.getRollingstockSpanNames = page.locator('.rollingstock-minicard-name');
    this.electricalCheckbox = this.rollingStockSelectorModal.locator('label').filter({
      hasText: electricCheckboxTranslation,
    });
  }

  async openRollingstockModal() {
    await this.rollingStockSelectorButton.click();
  }

  async isAnyRollingstockFound() {
    const resultFound = (await this.getResultsFound.textContent()) as string;
    expect(Number(resultFound.slice(0, 1)) >= 1).toBeTruthy();
  }

  async searchRollingstock(rollingstockName: string) {
    await this.getRollingStockSearch.fill(rollingstockName);
  }

  async selectRollingStock(rollingStockName: string) {
    await this.getRollingStockSearch.fill(rollingStockName);
    const rollingstockItem = this.rollingStockList.getByTestId(`rollingstock-${rollingStockName}`);
    await rollingstockItem.click();
    await rollingstockItem.locator('.rollingstock-footer-buttons > button').click();
  }

  getRollingstockCardByTestID(rollingstockTestID: string) {
    return this.rollingStockSelectorModal.getByTestId(rollingstockTestID);
  }

  getRollingStockMiniCardInfo() {
    return this.rollingStockMiniCards.locator('.rollingstock-info-end');
  }

  getRollingStockInfoComfort() {
    return this.rollingStockMiniCards.locator('.rollingstock-info-comfort');
  }

  async closeRollingstockModal() {
    await this.rollingStockSelectorModal.locator('.close').click();
  }
}
