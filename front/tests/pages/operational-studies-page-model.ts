import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page-model';
import manageTrainScheduleTranslation from '../../public/locales/fr/operationalStudies/manageTrainSchedule.json';

const trainAddedTranslation = manageTrainScheduleTranslation.trainAdded;

class OperationalStudiesPage extends CommonPage {
  readonly addScenarioTrainButton: Locator;

  readonly rollingStockTab: Locator;

  readonly routeTab: Locator;

  readonly startTimeField: Locator;

  readonly infraLoadState: Locator;

  readonly resultPathfindingDistance: Locator;

  readonly returnSimulationResultButton: Locator;

  readonly deltaInput: Locator;

  readonly trainCountInput: Locator;

  readonly trainScheduleNameInput: Locator;

  readonly addTrainScheduleButton: Locator;

  readonly trainTimetable: Locator;

  readonly simulationSettingsTab: Locator;

  readonly timesAndStopsTab: Locator;

  constructor(page: Page) {
    super(page);
    this.infraLoadState = page.locator('.infra-loading-state');
    this.resultPathfindingDistance = page.getByTestId('result-pathfinding-distance');
    this.addScenarioTrainButton = page.getByTestId('scenarios-add-train-schedule-button');
    this.rollingStockTab = page.getByTestId('tab-rollingstock');
    this.routeTab = page.getByTestId('tab-pathfinding');
    this.simulationSettingsTab = page.getByTestId('tab-simulation-settings');
    this.timesAndStopsTab = page.getByTestId('tab-timesStops');
    this.startTimeField = page.locator('#trainSchedule-startTime');
    this.returnSimulationResultButton = page.getByTestId('return-simulation-result');
    this.trainCountInput = page.locator('#osrdconf-traincount');
    this.deltaInput = page.locator('#osrdconf-delta');
    this.addTrainScheduleButton = page.getByTestId('add-train-schedules');
    this.trainScheduleNameInput = page.locator('#trainSchedule-name');

    this.trainTimetable = page
      .locator('.scenario-timetable-trains')
      .locator('.scenario-timetable-train');
  }

  // Clicks on the button to add a scenario train.
  async clickOnAddTrainButton() {
    await this.addScenarioTrainButton.click();
  }

  // Open Route Tab
  async clickOnRouteTab() {
    await this.routeTab.click();
  }

  // Open Rolling Stock Tab
  async clickOnRollingStockTab() {
    await this.rollingStockTab.click();
  }

  // Open Times And Stops Tab
  async clickOnTimesAndStopsTab() {
    await this.timesAndStopsTab.click();
  }

  // Open Simulation Settings Tab
  async clickOnSimulationSettingsTab() {
    await this.simulationSettingsTab.click();
  }

  // Verifies that the Rolling Stock and Route tabs have warning classes.
  async verifyTabWarningPresence() {
    await expect(this.rollingStockTab).toHaveClass(/warning/);
    await expect(this.routeTab).toHaveClass(/warning/);
  }

  // Verifies that the Rolling Stock and Route tabs do not have warning classes.
  async verifyTabWarningAbsence() {
    await expect(this.rollingStockTab).not.toHaveClass(/warning/);
    await expect(this.routeTab).not.toHaveClass(/warning/);
  }

  // Set the train start time
  async setTrainStartTime(departureTime: string) {
    const currentDate = new Date().toISOString().split('T')[0];
    const startTime = `${currentDate}T${departureTime}`;
    await this.startTimeField.waitFor({ state: 'visible' });
    await this.startTimeField.fill(startTime);
    await expect(this.startTimeField).toHaveValue(startTime);
  }

  async checkTrainHasBeenAdded() {
    this.checkLastToastTitle(trainAddedTranslation);
  }

  async returnSimulationResult() {
    await this.returnSimulationResultButton.click();
  }

  async checkPathfindingDistance(distance: string | RegExp) {
    await this.page.waitForSelector('[data-testid="result-pathfinding-distance"]');
    await expect(this.resultPathfindingDistance).toHaveText(distance);
  }

  async checkInfraLoaded() {
    await this.page.waitForSelector('.cached', { timeout: 2 * 60 * 1000 }); // Wait for the infrastructure to be fully loaded with a timeout of 2 minutes
    await expect(this.infraLoadState).toHaveClass(/cached/);
  }

  async setNumberOfTrains(trainCount: string) {
    await expect(this.trainCountInput).toBeVisible();
    await this.trainCountInput.fill(trainCount);
  }

  async setDelta(gapValue: string) {
    await expect(this.deltaInput).toBeVisible();
    await this.deltaInput.fill(gapValue);
  }

  async addTrainSchedule() {
    await this.addTrainScheduleButton.click();
  }

  async setTrainScheduleName(name: string) {
    await this.trainScheduleNameInput.fill(name);
    await expect(this.trainScheduleNameInput).toHaveValue(name);
  }

  async checkNumberOfTrains(number: number) {
    await expect(this.trainTimetable).toHaveCount(number);
  }
}
export default OperationalStudiesPage;
