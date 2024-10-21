import { type Locator, type Page, expect } from '@playwright/test';

import CommonPage from './common-page-model';
import { extractNumberFromString } from '../utils/index';

class RollingStockSelectorPage extends CommonPage {
  readonly rollingStockSelectorButton: Locator;

  readonly emptyRollingStockSelector: Locator;

  readonly rollingStockSelectorModal: Locator;

  readonly resultsFound: Locator;

  readonly rollingStockListItem: Locator;

  readonly rollingStockModalSearch: Locator;

  readonly rollingStockMiniCards: Locator;

  readonly rollingstockSpanNames: Locator;

  readonly electricRollingStockFilter: Locator;

  readonly thermalRollingStockFilter: Locator;

  readonly rollingStockSearchResult: Locator;

  readonly thermalRollingStockIcons: Locator;

  readonly electricRollingStockIcons: Locator;

  readonly electricRollingStockFirstIcon: Locator;

  readonly thermalRollingStockFirstIcon: Locator;

  readonly rollingStockList: Locator;

  readonly dualModeRollingStockIcons: Locator;

  readonly noRollingStockResult: Locator;

  readonly comfortHeatingButton: Locator;

  readonly comfortACButton: Locator;

  readonly selectedComfortType: Locator;

  readonly selectedRollingStockName: Locator;

  constructor(page: Page) {
    super(page);
    this.rollingStockSelectorButton = page.getByTestId('rollingstock-selector');
    this.rollingStockSelectorModal = page.locator('.modal-dialog');

    this.rollingStockList = page.locator('.rollingstock-editor-list .rollingstock-title');
    this.rollingStockListItem = page.locator('.rollingstock-container');
    this.emptyRollingStockSelector = page.getByTestId('rollingstock-selector-empty');
    this.resultsFound = page.locator('.modal-dialog').locator('small').first();
    this.rollingStockModalSearch = this.rollingStockSelectorModal.locator('#searchfilter');
    this.rollingStockMiniCards = page.locator('.rollingstock-selector-minicard');
    this.rollingstockSpanNames = page.locator('.rollingstock-minicard-name');
    this.electricRollingStockFilter = page.locator('label[for="elec"]');
    this.thermalRollingStockFilter = page.locator('label[for="thermal"]');
    this.rollingStockSearchResult = page.getByTestId('search-results-text');
    this.thermalRollingStockIcons = page.locator('.rollingstock-footer-specs .text-pink');
    this.electricRollingStockIcons = page.locator('.rollingstock-footer-specs .text-primary');
    this.dualModeRollingStockIcons = page
      .locator('.rollingstock-footer-specs .rollingstock-tractionmode:has(.text-pink)')
      .filter({
        has: page.locator('.text-primary'),
      });
    this.electricRollingStockFirstIcon = this.electricRollingStockIcons.first();
    this.thermalRollingStockFirstIcon = this.thermalRollingStockIcons.first();
    // this.rollingStockList = page.locator('.rollingstock-editor-list .rollingstock-title');
    this.noRollingStockResult = page.locator('.rollingstock-empty');
    this.comfortHeatingButton = page.getByTestId('comfort-heating-button');
    this.comfortACButton = page.getByTestId('comfort-ac-button');
    this.selectedComfortType = page.getByTestId('selected-comfort-type-info');
    this.selectedRollingStockName = page.getByTestId('selected-rolling-stock-info');
  }

  async openRollingstockModal() {
    await this.rollingStockSelectorButton.click();
  }

  async isAnyRollingstockFound() {
    const resultFound = (await this.resultsFound.textContent()) as string;
    expect(Number(resultFound.slice(0, 1)) >= 1).toBeTruthy();
  }

  async searchRollingstock(rollingstockName: string) {
    await this.rollingStockModalSearch.fill(rollingstockName);
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
  async setThermalRollingStockFilter() {
    await this.thermalRollingStockFilter.click();
  }

  // Select Electric RS filter
  async setElectricRollingStockFilter() {
    await this.electricRollingStockFilter.click();
  }

  // Get the number of RS from the search result text
  async getRollingStockSearchNumber(): Promise<number> {
    return extractNumberFromString(await this.rollingStockSearchResult.innerText());
  }

  // Clicks to open the empty rolling stock selector.
  async openEmptyRollingStockSelector() {
    await this.emptyRollingStockSelector.click();
  }

  // Open Rolling Stock Selector, search for the added train, and select it
  async selectRollingStock(rollingStockName: string) {
    await this.openEmptyRollingStockSelector();
    await this.searchRollingstock(rollingStockName);
    const rollingstockCard = this.getRollingstockCardByTestID(`rollingstock-${rollingStockName}`);
    await rollingstockCard.click();
    await rollingstockCard.locator('button').click();
    expect(await this.selectedRollingStockName.innerText()).toEqual(rollingStockName);
  }
}
export default RollingStockSelectorPage;
