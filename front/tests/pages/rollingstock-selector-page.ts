import { type Locator, type Page, expect } from '@playwright/test';

import BasePage from './base-page';
import { extractNumberFromString } from '../utils/index';

class RollingStockSelectorPage extends BasePage {
  readonly rollingStockSelectorButton: Locator;

  readonly rollingStockSelectorModal: Locator;

  readonly getResultsFound: Locator;

  private rollingStockList: Locator;

  readonly rollingStockListItem: Locator;

  readonly getRollingStockModalSearch: Locator;

  readonly rollingStockMiniCards: Locator;

  readonly getRollingstockSpanNames: Locator;

  readonly getElectricRollingStockFilter: Locator;

  readonly getThermalRollingStockFilter: Locator;

  readonly getRollingStockSearchResult: Locator;

  readonly getThermalRollingStockIcons: Locator;

  readonly getElectricRollingStockIcons: Locator;

  readonly getElectricRollingStockFirstIcon: Locator;

  readonly getThermalRollingStockFirstIcon: Locator;

  readonly getRollingStockList: Locator;

  readonly getDualModeRollingStockIcons: Locator;

  readonly getNoRollingStockResult: Locator;

  readonly comfortHeatingButton: Locator;

  readonly comfortACButton: Locator;

  readonly getSelectedComfortType: Locator;

  readonly getSelectedRollingStockName: Locator;

  constructor(page: Page) {
    super(page);
    this.rollingStockSelectorButton = page.getByTestId('rollingstock-selector');
    this.rollingStockSelectorModal = page.locator('.modal-dialog');

    this.rollingStockList = page.locator('.rollingstock-search-list');
    this.rollingStockListItem = page.locator('.rollingstock-container');

    this.getResultsFound = page.locator('.modal-dialog').locator('small').first();
    this.getRollingStockModalSearch = this.rollingStockSelectorModal.locator('#searchfilter');
    this.rollingStockMiniCards = page.locator('.rollingstock-selector-minicard');
    this.getRollingstockSpanNames = page.locator('.rollingstock-minicard-name');
    this.getElectricRollingStockFilter = page.locator('label[for="elec"]');
    this.getThermalRollingStockFilter = page.locator('label[for="thermal"]');
    this.getRollingStockSearchResult = page.getByTestId('search-results-text');
    this.getThermalRollingStockIcons = page.locator('.rollingstock-footer-specs .text-pink');
    this.getElectricRollingStockIcons = page.locator('.rollingstock-footer-specs .text-primary');
    this.getDualModeRollingStockIcons = page
      .locator('.rollingstock-footer-specs .rollingstock-tractionmode:has(.text-pink)')
      .filter({
        has: page.locator('.text-primary'),
      });
    this.getElectricRollingStockFirstIcon = this.getElectricRollingStockIcons.first();
    this.getThermalRollingStockFirstIcon = this.getThermalRollingStockIcons.first();
    this.getRollingStockList = page.locator('.rollingstock-editor-list .rollingstock-title');
    this.getNoRollingStockResult = page.locator('.rollingstock-empty');
    this.comfortHeatingButton = page.getByTestId('comfort-heating-button');
    this.comfortACButton = page.getByTestId('comfort-ac-button');
    this.getSelectedComfortType = page.getByTestId('selected-comfort-type-info');
    this.getSelectedRollingStockName = page.getByTestId('selected-rolling-stock-info');
  }

  async openRollingstockModal() {
    await this.rollingStockSelectorButton.click();
  }

  async isAnyRollingstockFound() {
    const resultFound = (await this.getResultsFound.textContent()) as string;
    expect(Number(resultFound.slice(0, 1)) >= 1).toBeTruthy();
  }

  async searchRollingstock(rollingstockName: string) {
    await this.getRollingStockModalSearch.fill(rollingstockName);
  }

  async selectRollingStock(rollingStockName: string) {
    await this.getRollingStockModalSearch.fill(rollingStockName);
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

  // Select Combustion engine RS filter
  async thermalRollingStockFilter() {
    await this.getThermalRollingStockFilter.click();
  }

  // Select Electric RS filter
  async electricRollingStockFilter() {
    await this.getElectricRollingStockFilter.click();
  }

  // Get the number of RS from the search result text
  async getRollingStockSearchNumber(): Promise<number> {
    return extractNumberFromString(await this.getRollingStockSearchResult.innerText());
  }
}
export default RollingStockSelectorPage;
