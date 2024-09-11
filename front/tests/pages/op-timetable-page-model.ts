import { type Locator, type Page, expect } from '@playwright/test';

import enTranslations from '../../public/locales/en/operationalStudies/scenario.json';
import frTranslations from '../../public/locales/fr/operationalStudies/scenario.json';

class OperationalStudiesTimetablePage {
  readonly page: Page;

  readonly invalidTrainsMessage: Locator;

  readonly timetableTrains: Locator;

  readonly selectedTimetableTrain: Locator;

  readonly simulationBar: Locator;

  readonly manchetteSpaceTimeChart: Locator;

  readonly spaceTimeChart: Locator;

  readonly speedSpaceChart: Locator;

  readonly timeStopsDatasheet: Locator;

  readonly simulationMap: Locator;

  readonly simulationDriverTrainSchedule: Locator;

  readonly timetableFilterButton: Locator;

  readonly timetableFilterButtonClose: Locator;

  constructor(page: Page) {
    this.page = page;
    this.invalidTrainsMessage = page.getByTestId('invalid-trains-message');
    this.timetableTrains = page.getByTestId('scenario-timetable-train');
    this.selectedTimetableTrain = page.locator('[data-testid="scenario-timetable-train"].selected');
    this.simulationBar = page.locator('.osrd-simulation-sticky-bar');
    this.manchetteSpaceTimeChart = page.locator('.manchette-space-time-chart-wrapper');
    this.speedSpaceChart = page.locator('#container-SpeedSpaceChart');
    this.spaceTimeChart = page.locator('.space-time-chart-container');
    this.timeStopsDatasheet = page.locator('.time-stops-datasheet');
    this.simulationMap = page.locator('.osrd-simulation-map');
    this.simulationDriverTrainSchedule = page.locator('.simulation-driver-train-schedule');
    this.timetableFilterButton = page.getByTestId('timetable-filter-button');
    this.timetableFilterButtonClose = page.getByTestId('timetable-filter-button-close');
  }

  // Function to wait for an element to be visible and then assert its visibility
  static async waitForElementVisibility(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible' });
    await expect(locator).toBeVisible();
  }

  // Gets the button locator of a train element.
  static getTrainButton(trainSelector: Locator): Locator {
    return trainSelector.getByTestId('scenario-timetable-train-button');
  }

  // Waits for the simulation results to be in the DOM
  async waitForSimulationResults(): Promise<void> {
    await this.page.waitForSelector('.simulation-results', { state: 'attached' });
  }

  // Verifies that the message "The timetable contains invalid trains" is visible
  async verifyInvalidTrainsMessageVisibility(selectedLanguage: string): Promise<void> {
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
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
    await this.page.waitForLoadState('networkidle');

    const simulationResultsLocators = [
      this.simulationBar,
      this.manchetteSpaceTimeChart,
      this.speedSpaceChart,
      this.spaceTimeChart,
      this.timeStopsDatasheet,
      this.simulationMap,
      this.simulationDriverTrainSchedule,
    ];
    await Promise.all(
      simulationResultsLocators.map((simulationResultsLocator) =>
        OperationalStudiesTimetablePage.waitForElementVisibility(simulationResultsLocator)
      )
    );
  }

  // Clicks the train validity filter button based on the provided translation
  async clickValidityTrainFilterButton(filterTranslation: string): Promise<void> {
    // TODO: use id on the Select element
    const filterButtonLocator = this.page.locator('#train-validity-and-label select');
    await filterButtonLocator.selectOption({ label: filterTranslation });
  }

  // Clicks the train honored filter button based on the provided translation
  async clickHonoredTrainFilterButton(filterTranslation: string): Promise<void> {
    // TODO: use id on the Select element
    const filterButtonLocator = this.page.locator(
      '#schedule-point-honored-and-rollingstock select'
    );
    await filterButtonLocator.selectOption({ label: filterTranslation });
  }

  // Filter train using composition codes button based on the provided translation and verify train count
  async clickCodeCompoTrainFilterButton(
    selectedLanguage: string,
    filterTranslation: string | null,
    expectedTrainCount: number
  ): Promise<void> {
    await this.timetableFilterButton.click();
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;

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

  // Verifies that the imported train number is correct
  async verifyTrainCount(trainCount: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    const trainCard = await this.timetableTrains;
    expect(trainCard).toHaveCount(trainCount);
  }

  // Filter trains validity and verify their count
  async filterValidityAndVerifyTrainCount(
    selectedLanguage: string,
    validityFilter: 'Valid' | 'Invalid' | 'All',
    expectedTrainCount: number
  ): Promise<void> {
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
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
    selectedLanguage: string,
    honoredFilter: 'Honored' | 'Not honored' | 'All',
    expectedTrainCount: number
  ): Promise<void> {
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
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
      await this.page.waitForLoadState('networkidle');
      await this.waitForSimulationResults();
      const trainButton = OperationalStudiesTimetablePage.getTrainButton(
        this.timetableTrains.nth(currentTrainIndex)
      );
      await trainButton.click({ position: { x: 5, y: 5 } });
      await this.verifySimulationResultsVisibility();
    }
  }

  async verifyTimeStopsDatasheetVisibility(timeout = 30 * 1000): Promise<void> {
    await this.timeStopsDatasheet.scrollIntoViewIfNeeded();
    // Wait for the Times and Stops simulation datasheet to be fully loaded with a specified timeout (default: 30 seconds)
    await expect(this.timeStopsDatasheet).toBeVisible({ timeout });
  }
}

export default OperationalStudiesTimetablePage;
