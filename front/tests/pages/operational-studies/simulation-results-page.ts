import { expect, type Locator, type Page } from '@playwright/test';

import { SIMULATION_RESULT_TIMEOUT } from '../../assets/constants/timeout-const';
import CommonPage from '../common-page';

class OpSimulationResultPage extends CommonPage {
  private readonly speedSpaceChartSettingsButton: Locator;

  private readonly speedSpaceChartCheckboxItems: Locator;

  readonly speedSpaceChartTabindexElement: Locator;

  private readonly speedSpaceChartCloseSettingsButton: Locator;

  private readonly manchetteSpaceTimeChart: Locator;

  private readonly spaceTimeChart: Locator;

  private readonly speedSpaceChart: Locator;

  readonly timesStopsDataSheet: Locator;

  private readonly simulationMap: Locator;

  constructor(page: Page) {
    super(page);
    this.manchetteSpaceTimeChart = page.getByTestId('manchette-space-time-chart');
    this.speedSpaceChart = page.getByTestId('speed-space-chart');
    this.spaceTimeChart = page.getByTestId('space-time-chart-container');
    this.timesStopsDataSheet = page.locator('.time-stops-datasheet');
    this.simulationMap = page.getByTestId('simulation-map');
    this.speedSpaceChartSettingsButton = page.locator('.interaction-button.elipsis-button');
    this.speedSpaceChartCloseSettingsButton = page.locator('#close-settings-panel');
    this.speedSpaceChartCheckboxItems = page.locator('#settings-panel .selection .checkmark');
    this.speedSpaceChartTabindexElement = page.locator(
      '#container-SpeedSpaceChart > div[tabindex="0"]'
    );
  }

  private async openSettingsPanel(): Promise<void> {
    await this.speedSpaceChartSettingsButton.click();
  }

  private async closeSettingsPanel(): Promise<void> {
    await this.speedSpaceChartCloseSettingsButton.click();
  }

  // Verify that simulation results are displayed
  async verifySimulationResultsVisibility(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.manchetteSpaceTimeChart).toBeVisible();
    await expect(this.speedSpaceChart).toBeVisible();
    await expect(this.spaceTimeChart).toBeVisible();
    await expect(this.simulationMap).toBeVisible();
    await expect(this.timesStopsDataSheet).toBeVisible();
  }

  async verifyTimesStopsDataSheetVisibility(): Promise<void> {
    await expect(this.timesStopsDataSheet).toBeVisible({ timeout: SIMULATION_RESULT_TIMEOUT });
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
