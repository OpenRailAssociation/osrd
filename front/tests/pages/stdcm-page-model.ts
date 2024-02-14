import { expect, Locator, Page } from '@playwright/test';

import BasePage from './base-page';

export default class PlaywrightSTDCMPage extends BasePage {
  readonly missingParams: Locator;

  // Scenario Explorator
  private scenarioExplorerButton: Locator;

  readonly scenarioExplorerModal: Locator;

  private scenarioExplorerMinicards: Locator;

  // Rolling stock selector
  readonly rollingStockSelectorButton: Locator;

  readonly rollingStockSelectorModal: Locator;

  private rollingStockList: Locator;

  readonly getRollingStockSearch: Locator;

  readonly rollingStockListItem: Locator;

  // STDCM
  private getOriginTimeDelta: Locator;

  constructor(page: Page) {
    super(page);

    this.missingParams = page.locator('.missing-params');

    // Scenario Explorator
    this.scenarioExplorerButton = page.getByTestId('scenario-explorator');
    this.scenarioExplorerModal = page.locator('.scenario-explorator-modal');
    this.scenarioExplorerMinicards = page.locator('.minicard');

    // Rollingstock
    this.rollingStockSelectorModal = page.locator('.modal-dialog');
    this.rollingStockSelectorButton = page.getByTestId('rollingstock-selector');
    this.rollingStockList = page.locator('.rollingstock-search-list');
    this.rollingStockListItem = page.locator('.rollingstock-container');
    this.getRollingStockSearch = this.rollingStockSelectorModal.locator('#searchfilter');

    // STDCM
    this.getOriginTimeDelta = page.locator('#osrd-config-time-origin').first();
  }

  async navigateToPage() {
    await this.page.goto('/stdcm/');
    await this.removeViteOverlay();
  }

  // Scenario Explorator
  async openScenarioExplorer() {
    await this.scenarioExplorerButton.click();
    await expect(this.scenarioExplorerModal).toBeVisible();
  }

  async selectMiniCard(itemName: string) {
    const miniCards = this.scenarioExplorerMinicards.getByText(itemName);
    await miniCards.first().click();
  }

  // Rollingstock
  async openRollingstockModal() {
    await this.rollingStockSelectorButton.click();
  }

  async selectRollingStock(rollingStockName: string) {
    await this.getRollingStockSearch.fill(rollingStockName);
    const rollingstockItem = this.rollingStockList.getByTestId(`rollingstock-${rollingStockName}`);
    await rollingstockItem.click();
    await rollingstockItem.locator('.rollingstock-footer-buttons > button').click();
  }

  async closeRollingstockModal() {
    await this.rollingStockSelectorModal.locator('.close').click();
  }

  // STDCM
  async setOriginTime(digits: string) {
    const splittedDigit = digits.split('');
    await this.getOriginTimeDelta.focus();
    splittedDigit.forEach(async (digit) => {
      await this.page.keyboard.press(digit);
    });
  }
}
