import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page-model';
import readJsonFile from '../utils/file-utils';

const manageTrainScheduleTranslation: { trainAdded: string } = readJsonFile(
  'public/locales/fr/operationalStudies/manageTrainSchedule.json'
);

const trainAddedTranslation = manageTrainScheduleTranslation.trainAdded;

class OperationalStudiesPage extends CommonPage {
  private readonly addScenarioTrainButton: Locator;

  private readonly rollingStockTab: Locator;

  private readonly routeTab: Locator;

  private readonly startTimeField: Locator;

  private readonly resultPathfindingDistance: Locator;

  private readonly returnSimulationResultButton: Locator;

  private readonly trainCountInput: Locator;

  private readonly trainScheduleNameInput: Locator;

  private readonly addTrainScheduleButton: Locator;

  private readonly trainTimetable: Locator;

  private readonly simulationSettingsTab: Locator;

  private readonly timesAndStopsTab: Locator;

  constructor(page: Page) {
    super(page);
    this.resultPathfindingDistance = page.getByTestId('result-pathfinding-distance');
    this.addScenarioTrainButton = page.getByTestId('scenarios-add-train-schedule-button');
    this.rollingStockTab = page.getByTestId('tab-rollingstock');
    this.routeTab = page.getByTestId('tab-pathfinding');
    this.simulationSettingsTab = page.getByTestId('tab-simulation-settings');
    this.timesAndStopsTab = page.getByTestId('tab-timesStops');
    this.startTimeField = page.locator('#trainSchedule-startTime');
    this.returnSimulationResultButton = page.getByTestId('return-simulation-result');
    this.trainCountInput = page.locator('#osrdconf-traincount');
    this.addTrainScheduleButton = page.getByTestId('add-train-schedules');
    this.trainScheduleNameInput = page.locator('#trainSchedule-name');

    this.trainTimetable = page
      .locator('.scenario-timetable-trains')
      .locator('.scenario-timetable-train');
  }

  // Click on the button to add a scenario train.
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

  // Verify that the Rolling Stock and Route tabs have warning classes.
  async verifyTabWarningPresence() {
    await expect(this.rollingStockTab).toHaveClass(/warning/);
    await expect(this.routeTab).toHaveClass(/warning/);
  }

  // Verify that the Rolling Stock and Route tabs do not have warning classes.
  async verifyTabWarningAbsence() {
    await expect(this.rollingStockTab).not.toHaveClass(/warning/);
    await expect(this.routeTab).not.toHaveClass(/warning/);
  }

  // Set the train start time
  async setTrainStartTime(departureTime: string) {
    const currentDate = new Date().toISOString().split('T')[0];
    const startTime = `${currentDate}T${departureTime}`;
    await this.startTimeField.waitFor();
    await this.startTimeField.fill(startTime);
    await this.startTimeField.dispatchEvent('blur');
    await expect(this.startTimeField).toHaveValue(startTime);
  }

  async checkTrainHasBeenAdded() {
    await this.checkLastToastTitle(trainAddedTranslation);
  }

  async returnSimulationResult() {
    await this.returnSimulationResultButton.click();
  }

  async checkPathfindingDistance(distance: string | RegExp) {
    await this.resultPathfindingDistance.waitFor();
    await expect(this.resultPathfindingDistance).toHaveText(distance);
  }

  async setNumberOfTrains(trainCount: string) {
    await expect(this.trainCountInput).toBeVisible();
    await this.trainCountInput.fill(trainCount);
  }

  async addTrainSchedule() {
    await this.addTrainScheduleButton.click();
    await this.closeToastNotification();
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
