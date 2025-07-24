import { type Locator, type Page, expect } from '@playwright/test';

import { extractNumberFromString } from '../../utils/index';
import CommonPage from '../common-page';

class RollingStockSelector extends CommonPage {
  private readonly rollingStockSelectorButton: Locator;

  private readonly emptyRollingStockSelector: Locator;

  readonly rollingStockSelectorModal: Locator;

  private readonly rollingStockModalSearch: Locator;

  private readonly rollingStockMiniCards: Locator;

  private readonly electricRollingStockFilter: Locator;

  private readonly thermalRollingStockFilter: Locator;

  private readonly rollingStockSearchResult: Locator;

  readonly thermalRollingStockIcons: Locator;

  readonly electricRollingStockIcons: Locator;

  readonly electricRollingStockFirstIcon: Locator;

  readonly thermalRollingStockFirstIcon: Locator;

  readonly rollingStockList: Locator;

  readonly dualModeRollingStockIcons: Locator;

  readonly noRollingStockResult: Locator;

  readonly comfortACButton: Locator;

  readonly selectedComfortType: Locator;

  readonly selectedRollingStockName: Locator;

  readonly rollingStockNameTab: Locator;

  constructor(page: Page) {
    super(page);
    this.rollingStockSelectorButton = page.getByTestId('rollingstock-selector');
    this.rollingStockSelectorModal = page.getByTestId('rollingstock-selector-modal');
    this.rollingStockList = page.getByTestId('rollingstock-title');
    this.emptyRollingStockSelector = page.getByTestId('rollingstock-selector-empty');
    this.rollingStockModalSearch = this.rollingStockSelectorModal.locator('#searchfilter');
    this.rollingStockMiniCards = page.getByTestId('rollingstock-selector-minicard');
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
    this.noRollingStockResult = page.getByTestId('rollingstock-empty-result');
    this.comfortACButton = page.getByTestId('comfort-ac-button');
    this.selectedComfortType = page.getByTestId('selected-comfort-type-info');
    this.selectedRollingStockName = page.getByTestId('selected-rolling-stock-info');
    this.rollingStockNameTab = page.getByTestId('rolling-stock-name-tab');
  }

  async openRollingstockModal() {
    await this.rollingStockSelectorButton.click();
  }

  async searchRollingstock(rollingstockName: string) {
    await this.rollingStockModalSearch.fill(rollingstockName);
  }

  getRollingstockCardByName(rollingstockName: string) {
    return this.rollingStockSelectorModal.getByTestId(`rollingstock-${rollingstockName}`);
  }

  async selectRollingStockCard({
    name,
    selectComfort = false,
    confirmSelection = false,
  }: {
    name: string;
    selectComfort?: boolean;
    confirmSelection?: boolean;
  }): Promise<void> {
    const rollingstockCard = this.getRollingstockCardByName(name);
    await expect(rollingstockCard).toBeVisible();
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);
    if (selectComfort) await this.comfortACButton.click();
    if (confirmSelection) {
      await rollingstockCard.getByTestId('select-rolling-stock-button').click();
      await expect(this.rollingStockSelectorModal).toBeHidden();
    }
  }

  async verifyRollingStockIsInactive(rollingstockName: string): Promise<void> {
    const rollingstockCard = this.getRollingstockCardByName(rollingstockName);
    await expect(rollingstockCard).toHaveClass(/inactive/);
  }

  async verifySelectedComfortMatches(expectedComfort: string): Promise<void> {
    const selectedComfort = await this.selectedComfortType.innerText();
    expect(selectedComfort).toMatch(new RegExp(expectedComfort, 'i'));
  }

  getRollingStockMiniCardInfo() {
    return this.rollingStockMiniCards.getByTestId('selected-rolling-stock-info');
  }

  getRollingStockInfoComfort() {
    return this.rollingStockMiniCards.getByTestId('rollingstock-info-comfort');
  }

  async toggleThermalRollingStockFilter() {
    await this.thermalRollingStockFilter.click();
    await this.waitForLoaderToDisappear();
  }

  async toggleElectricRollingStockFilter() {
    await this.electricRollingStockFilter.click();
    await this.waitForLoaderToDisappear();
  }

  async getRollingStockSearchNumber(): Promise<number> {
    return extractNumberFromString(await this.rollingStockSearchResult.innerText());
  }

  async openEmptyRollingStockSelector() {
    await this.emptyRollingStockSelector.click();
  }

  // Open Rolling Stock Selector, search for the added train, and select it
  async selectRollingStock(rollingStockName: string): Promise<void> {
    await this.openEmptyRollingStockSelector();
    await this.searchRollingstock(rollingStockName);
    await this.selectRollingStockCard({
      name: rollingStockName,
      confirmSelection: true,
    });

    await expect(this.selectedRollingStockName).toHaveText(rollingStockName);
    await expect(this.rollingStockNameTab).toHaveText(rollingStockName);
  }
}
export default RollingStockSelector;
