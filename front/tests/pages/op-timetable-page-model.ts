import { type Locator, type Page, expect } from '@playwright/test';

import CommonPage from './common-page-model';
import { EXPLICIT_UI_STABILITY_TIMEOUT, SIMULATION_RESULT_TIMEOUT } from '../assets/timeout-const';
import { getTranslations, readJsonFile } from '../utils';

const enTranslations = readJsonFile('public/locales/en/operationalStudies/scenario.json');
const frTranslations = readJsonFile('public/locales/fr/operationalStudies/scenario.json');

class OperationalStudiesTimetablePage extends CommonPage {
  readonly invalidTrainsMessage: Locator;

  readonly timetableTrains: Locator;

  readonly selectedTimetableTrain: Locator;

  // TODO: remove this commented code when the design of simulation bar has been changed
  // readonly simulationBar: Locator;

  readonly manchetteSpaceTimeChart: Locator;

  readonly spaceTimeChart: Locator;

  readonly speedSpaceChart: Locator;

  readonly timesStopsDataSheet: Locator;

  readonly simulationMap: Locator;

  readonly timetableFilterButton: Locator;

  readonly timetableFilterButtonClose: Locator;

  readonly editTrainButton: Locator;

  readonly editTrainScheduleButton: Locator;

  readonly trainArrivalTime: Locator;

  readonly scenarioCollapseButton: Locator;

  readonly timetableCollapseButton: Locator;

  readonly scenarioSideMenu: Locator;

  readonly simulationResult: Locator;

  constructor(page: Page) {
    super(page);
    this.invalidTrainsMessage = page.getByTestId('invalid-trains-message');
    this.timetableTrains = page.getByTestId('scenario-timetable-train');
    this.selectedTimetableTrain = page.locator('[data-testid="scenario-timetable-train"].selected');
    // TODO: remove this commented code when the design of simulation bar has been changed
    // this.simulationBar = page.locator('.osrd-simulation-sticky-bar');
    this.manchetteSpaceTimeChart = page.locator('.manchette-space-time-chart-wrapper');
    this.speedSpaceChart = page.locator('#container-SpeedSpaceChart');
    this.spaceTimeChart = page.locator('.space-time-chart-container');
    this.timesStopsDataSheet = page.locator('.time-stops-datasheet');
    this.simulationMap = page.locator('.simulation-map');
    this.timetableFilterButton = page.getByTestId('timetable-filter-button');
    this.timetableFilterButtonClose = page.getByTestId('timetable-filter-button-close');
    this.editTrainButton = page.getByTestId('edit-train');
    this.editTrainScheduleButton = page.getByTestId('submit-edit-train-schedule');
    this.trainArrivalTime = page.locator('.train-time').getByTestId('train-arrival-time');
    this.scenarioCollapseButton = page.getByTestId('scenario-collapse-button');
    this.timetableCollapseButton = page.getByTestId('timetable-collapse-button');
    this.scenarioSideMenu = page.getByTestId('scenario-sidemenu');
    this.simulationResult = page.locator('.simulation-results');
  }

  // Get the button locator of a train element.
  static getTrainButton(trainSelector: Locator): Locator {
    return trainSelector.getByTestId('scenario-timetable-train-button');
  }

  // Verify that the message "The timetable contains invalid trains" is visible
  async verifyInvalidTrainsMessageVisibility(): Promise<void> {
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
    const invalidTrainsMessageText = await this.invalidTrainsMessage.innerText();
    expect(invalidTrainsMessageText).toEqual(translations.timetable.invalidTrains);
  }

  // Verify that the train is selected by default
  async checkSelectedTimetableTrain(): Promise<void> {
    await this.page.waitForSelector('.selected');
    await expect(this.selectedTimetableTrain).toBeVisible();
  }

  // Verify that simulation results are displayed
  async verifySimulationResultsVisibility(): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout: SIMULATION_RESULT_TIMEOUT });

    const simulationResultsLocators = [
      // TODO: remove this commented code when the design of simulation bar has been changed
      // this.simulationBar,
      this.manchetteSpaceTimeChart,
      this.speedSpaceChart,
      this.spaceTimeChart,
      this.simulationMap,
      this.timesStopsDataSheet,
    ];
    await Promise.all(
      simulationResultsLocators.map(async (simulationResultsLocator) => {
        await expect(simulationResultsLocator).toBeVisible();
      })
    );
  }

  // Click the train validity filter button based on the provided translation
  async clickValidityTrainFilterButton(filterTranslation: string): Promise<void> {
    // TODO: use id on the Select element
    const filterButtonLocator = this.page.locator('#train-validity-and-label select');
    await filterButtonLocator.selectOption({ label: filterTranslation });
  }

  // Click the train honored filter button based on the provided translation
  async clickHonoredTrainFilterButton(filterTranslation: string): Promise<void> {
    // TODO: use id on the Select element
    const filterButtonLocator = this.page.locator(
      '#schedule-point-honored-and-rollingstock select'
    );
    await filterButtonLocator.selectOption({ label: filterTranslation });
  }

  // Filter train using composition codes button based on the provided translation and verify train count
  async clickCodeCompoTrainFilterButton(
    filterTranslation: string | null,
    expectedTrainCount: number
  ): Promise<void> {
    await this.timetableFilterButton.click();
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });

    const filterButtonLocator = !filterTranslation
      ? this.page.getByRole('button', {
          name: translations.timetable.noSpeedLimitTagsShort,
        })
      : this.page.getByRole('button', { name: filterTranslation });

    await filterButtonLocator.click();
    await this.verifyTrainCount(expectedTrainCount);
    await filterButtonLocator.click();
    await this.timetableFilterButtonClose.click();
  }

  // Verify that the imported train number is correct
  async verifyTrainCount(trainCount: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await expect(this.timetableTrains).toHaveCount(trainCount);
  }

  // Filter trains validity and verify their count
  async filterValidityAndVerifyTrainCount(
    validityFilter: 'Valid' | 'Invalid' | 'All',
    expectedTrainCount: number
  ): Promise<void> {
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
    await this.timetableFilterButton.click();

    const validityFilters = {
      Valid: translations.timetable.showValidTrains,
      Invalid: translations.timetable.showInvalidTrains,
      All: translations.timetable.showAllTrains,
    };

    await this.clickValidityTrainFilterButton(validityFilters[validityFilter]);
    await this.timetableFilterButtonClose.click();
    await this.verifyTrainCount(expectedTrainCount);
  }

  // Filter the honored trains and verify their count
  async filterHonoredAndVerifyTrainCount(
    honoredFilter: 'Honored' | 'Not honored' | 'All',
    expectedTrainCount: number
  ): Promise<void> {
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
    await this.timetableFilterButton.click();

    const honoredFilters = {
      Honored: translations.timetable.showHonoredTrains,
      'Not honored': translations.timetable.showNotHonoredTrains,
      All: translations.timetable.showAllTrains,
    };

    await this.clickHonoredTrainFilterButton(honoredFilters[honoredFilter]);
    await this.timetableFilterButtonClose.click();
    await this.verifyTrainCount(expectedTrainCount);
  }

  // Iterate over each train element and verify the visibility of simulation results
  async verifyEachTrainSimulation(): Promise<void> {
    const trainCount = await this.timetableTrains.count();

    for (let currentTrainIndex = 0; currentTrainIndex < trainCount; currentTrainIndex += 1) {
      await this.page.waitForLoadState();
      await this.simulationResult.waitFor();
      const trainButton = OperationalStudiesTimetablePage.getTrainButton(
        this.timetableTrains.nth(currentTrainIndex)
      );
      await trainButton.click({ position: { x: 5, y: 5 } });
      await this.verifySimulationResultsVisibility();
    }
  }

  async verifyTimesStopsDataSheetVisibility(): Promise<void> {
    await expect(this.timesStopsDataSheet).toBeVisible({ timeout: SIMULATION_RESULT_TIMEOUT });
    await this.timesStopsDataSheet.scrollIntoViewIfNeeded();
  }

  async clickOnEditTrain() {
    await this.timetableTrains.first().hover();
    await this.editTrainButton.click();
  }

  async clickOnEditTrainSchedule() {
    await this.editTrainScheduleButton.click();
    await this.closeToastNotification();
  }

  async getTrainArrivalTime(expectedArrivalTime: string) {
    await expect(this.trainArrivalTime).toBeVisible();
    await this.page.waitForTimeout(EXPLICIT_UI_STABILITY_TIMEOUT);
    const actualArrivalTime = await this.trainArrivalTime.textContent();
    expect(actualArrivalTime).toEqual(expectedArrivalTime);
  }

  async clickOnScenarioCollapseButton() {
    await expect(this.scenarioCollapseButton).toBeVisible();
    await this.scenarioCollapseButton.click();
    await expect(this.scenarioSideMenu).toBeHidden();
  }

  async clickOnTimetableCollapseButton() {
    await expect(this.timetableCollapseButton).toBeVisible();
    await this.timetableCollapseButton.click();
    await expect(this.scenarioSideMenu).toBeVisible();
  }
}

export default OperationalStudiesTimetablePage;
