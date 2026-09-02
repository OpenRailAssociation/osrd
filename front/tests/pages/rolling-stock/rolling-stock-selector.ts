import { type Locator, type Page, expect } from '@playwright/test';

import { extractNumberFromString } from '../../utils/index';
import CommonPage from '../common-page';

class RollingStockSelector extends CommonPage {
  private readonly emptyRollingStockSelector: Locator;
  readonly rollingStockSelectorModal: Locator;
  private readonly rollingStockModalSearch: Locator;
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
  readonly selectedRollingStockName: Locator;
  readonly rollingStockNameTab: Locator;

  constructor(page: Page) {
    super(page);
    this.rollingStockSelectorModal = page.getByTestId('rollingstock-selector-modal');
    this.rollingStockList = page.getByTestId('rollingstock-title');
    this.emptyRollingStockSelector = page.getByTestId('rollingstock-selector-empty');
    this.rollingStockModalSearch = this.rollingStockSelectorModal.getByTestId('searchfilter-input');
    this.electricRollingStockFilter = page.locator('label[for="elec"]');
    this.thermalRollingStockFilter = page.locator('label[for="thermal"]');
    this.rollingStockSearchResult = page.getByTestId('search-results-text');
    this.thermalRollingStockIcons = page.getByTestId('traction-mode-thermal');
    this.electricRollingStockIcons = page.getByTestId('traction-mode-electric');
    this.dualModeRollingStockIcons = page
      .getByTestId('rollingstock-tractionmode')
      .filter({ has: this.thermalRollingStockIcons })
      .filter({ has: this.electricRollingStockIcons });
    this.electricRollingStockFirstIcon = this.electricRollingStockIcons.first();
    this.thermalRollingStockFirstIcon = this.thermalRollingStockIcons.first();
    this.noRollingStockResult = page.getByTestId('rollingstock-empty-result');
    this.comfortACButton = page.getByTestId('comfort-ac-button');
    this.selectedRollingStockName = page.getByTestId('selected-rolling-stock-info');
    this.rollingStockNameTab = page.getByTestId('rolling-stock-name-tab');
  }

  getRollingstockCardByName(rollingstockName: string) {
    return this.rollingStockSelectorModal.getByTestId(`rollingstock-${rollingstockName}`);
  }

  private getRollingStockSearchButton(locator: Locator) {
    return locator.getByTestId('select-rolling-stock-button');
  }

  async searchRollingstock(rollingstockName: string) {
    await this.rollingStockModalSearch.fill(rollingstockName);
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
      await this.getRollingStockSearchButton(rollingstockCard).click();
      await expect(this.rollingStockSelectorModal).toBeHidden();
    }
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
    const rollingStockText = await this.rollingStockSearchResult.innerText();
    return extractNumberFromString(rollingStockText);
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
