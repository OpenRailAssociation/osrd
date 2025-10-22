import { expect, type Locator, type Page } from '@playwright/test';

import ScenarioPage from './scenario-page';
import { toggleByState } from '../../utils';

class OpSimulationResultPage extends ScenarioPage {
  readonly simulationResults: Locator;

  private readonly speedSpaceChartSettingsButton: Locator;

  private readonly speedSpaceChartCheckboxItems: Locator;

  private readonly speedSpaceChartCloseSettingsButton: Locator;

  readonly manchetteSpaceTimeChart: Locator;

  readonly spaceTimeChart: Locator;

  readonly speedSpaceChart: Locator;

  readonly timesStopsDataSheet: Locator;

  private readonly simulationMap: Locator;

  private readonly trainList: Locator;

  private readonly timeStopsOutputs: Locator;

  private readonly macroEditor: Locator;

  private readonly conflictsList: Locator;

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
    this.speedSpaceChartCheckboxItems = page.locator('#settings-panel .checkmark');
    this.conflictsList = page.getByTestId('conflicts-list');
    this.trainList = page.getByTestId('scenario-left-column');
    this.simulationMap = page.getByTestId('simulation-map');
    this.timeStopsOutputs = page.getByTestId('time-stop-outputs');
    this.macroEditor = page.getByTestId('macro-editor');
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

  async setConflictsListVisible(isVisible = false) {
    await toggleByState(this.conflictsButton, this.conflictsList, isVisible);
  }

  async setTrainListVisible(isVisible = true) {
    await toggleByState(this.trainsButton, this.trainList, isVisible);
  }

  async setStdVisible(isVisible = true) {
    await toggleByState(
      this.stdButton,
      [this.spaceTimeChart, this.manchetteSpaceTimeChart],
      isVisible
    );
  }

  async setSddVisible(isVisible = true) {
    await toggleByState(this.sddButton, this.speedSpaceChart, isVisible);
  }

  async setMapVisible(isVisible = true) {
    await toggleByState(this.simulationMapButton, this.simulationMap, isVisible);
  }

  async setTableOutputVisible(isVisible = true) {
    await toggleByState(this.timeStopsOutputsButton, this.timeStopsOutputs, isVisible);
  }

  async setMacroVisible(isVisible = false) {
    await toggleByState(this.macroEditorButton, this.macroEditor, isVisible);
  }

  async enableMacroViewWithDefaultTrainList(): Promise<void> {
    await this.setStdVisible();
    await this.setMapVisible();
    await this.setSddVisible();
    await this.setTableOutputVisible();
    await this.setMacroVisible();
    await this.waitForLoaderToDisappear({ timeout: 15_000 });
  }
}

export default OpSimulationResultPage;
