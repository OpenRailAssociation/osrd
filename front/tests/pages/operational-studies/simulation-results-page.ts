import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from '../common-page';

class OpSimulationResultPage extends CommonPage {
  readonly simulationResults: Locator;

  private readonly speedSpaceChartSettingsButton: Locator;

  private readonly speedSpaceChartCheckboxItems: Locator;

  private readonly speedSpaceChartCloseSettingsButton: Locator;

  readonly manchetteSpaceTimeChart: Locator;

  readonly spaceTimeChart: Locator;

  readonly speedSpaceChart: Locator;

  readonly timesStopsDataSheet: Locator;

  private readonly simulationMap: Locator;

  constructor(page: Page) {
    super(page);
    this.simulationResults = page.getByTestId('simulation-results');
    this.manchetteSpaceTimeChart = page.getByTestId('manchette-space-time-chart');
    this.speedSpaceChart = page.getByTestId('speed-space-chart');
    this.spaceTimeChart = page.getByTestId('space-time-chart-container');
    this.timesStopsDataSheet = page.locator('.time-stops-datasheet');
    this.simulationMap = page.getByTestId('simulation-map');
    this.speedSpaceChartSettingsButton = page.getByTestId('interaction-settings');
    this.speedSpaceChartCloseSettingsButton = page.getByTestId('settings-panel-close');
    this.speedSpaceChartCheckboxItems = page.locator('#settings-panel .selection .checkmark');
  }

  private async openSettingsPanel(): Promise<void> {
    await this.speedSpaceChartSettingsButton.click();
  }

  private async closeSettingsPanel(): Promise<void> {
    await this.speedSpaceChartCloseSettingsButton.click();
  }

  async verifySimulationResultsVisibility(): Promise<void> {
    await Promise.all([
      expect(this.manchetteSpaceTimeChart).toBeVisible(),
      expect(this.speedSpaceChart).toBeVisible(),
      expect(this.spaceTimeChart).toBeVisible(),
      expect(this.simulationMap).toBeVisible(),
      expect(this.timesStopsDataSheet).toBeVisible(),
    ]);
  }

  async verifyTimesStopsDataSheetVisibility(): Promise<void> {
    await expect(this.timesStopsDataSheet).toBeVisible();
    await this.timesStopsDataSheet.scrollIntoViewIfNeeded();
  }

  // Ensures all checkboxes in the settings panel are checked.
  async selectAllSpeedSpaceChartCheckboxes(): Promise<void> {
    await this.openSettingsPanel();

    const checkboxes = await this.speedSpaceChartCheckboxItems.all();
    await Promise.all(checkboxes.map((checkbox) => checkbox.setChecked(true, { force: true })));
    await this.closeSettingsPanel();
    await this.speedSpaceChartSettingsButton.hover(); // Hover over the element to prevent the tooltip from displaying
  }
}

export default OpSimulationResultPage;
