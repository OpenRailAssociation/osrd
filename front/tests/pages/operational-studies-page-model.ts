import { expect, type Locator, type Page } from '@playwright/test';

class OperationalStudiesPage {
  readonly addScenarioTrainBtn: Locator;

  readonly getRollingStockTab: Locator;

  readonly getRouteTab: Locator;

  readonly getRollingStockSelector: Locator;

  readonly getEmptyRollingStockSelector: Locator;

  constructor(readonly page: Page) {
    this.page = page;
    this.addScenarioTrainBtn = page.getByTestId('scenarios-add-train-schedule-button');
    this.getRollingStockTab = page.getByTestId('tab-rollingstock');
    this.getRouteTab = page.getByTestId('tab-pathfinding');
    this.getEmptyRollingStockSelector = page.getByTestId('rollingstock-selector-empty');
    this.getRollingStockSelector = page.getByTestId('rollingstock-selector');
  }

  // Methods

  // Clicks on the button to add a scenario train.
  async clickOnAddScenarioTrainBtn() {
    await this.addScenarioTrainBtn.click();
  }

  // Verifies that the Rolling Stock and Route tabs have warning classes.
  async verifyTabWarningPresence() {
    await expect(this.getRollingStockTab).toHaveClass(/warning/);
    await expect(this.getRouteTab).toHaveClass(/warning/);
  }

  // Verifies that the Rolling Stock and Route tabs do not have warning classes.
  async verifyTabWarningAbsence() {
    await expect(this.getRollingStockTab).not.toHaveClass(/warning/);
    await expect(this.getRouteTab).not.toHaveClass(/warning/);
  }

  // Clicks to open the empty rolling stock selector.
  async openEmptyRollingStockSelector() {
    await this.getEmptyRollingStockSelector.click();
  }

  // Clicks to open the rolling stock selector
  async openRollingStockSelector() {
    await this.getRollingStockSelector.click();
  }
}
export default OperationalStudiesPage;
