import { expect, type Locator, type Page } from '@playwright/test';

import {
  DEFAULT_PACED_TRAIN_SETTINGS,
  PACED_TRAIN_SETTINGS_TEST,
} from '../../assets/constants/operational-studies-const';
import type { ManageTrainScheduleTranslations, PacedTrainDetails } from '../../utils/types';
import CommonPage from '../common-page';

class OperationalStudiesPage extends CommonPage {
  private readonly addScenarioTrainButton: Locator;

  private readonly rollingStockTab: Locator;

  private readonly routeTab: Locator;

  private readonly startTimeField: Locator;

  private readonly resultPathfindingDistance: Locator;

  private readonly returnSimulationResultButton: Locator;

  private readonly trainCountInput: Locator;

  private readonly operationStudiesSettings: Locator;

  private readonly userSettings: Locator;

  private readonly modalCloseButton: Locator;

  private readonly pacedTrainSwitch: Locator;

  private readonly definePacedTrainCheckbox: Locator;

  private readonly definePacedTrainCheckboxLabel: Locator;

  private readonly pacedTrainTimeRangeDurationInput: Locator;

  private readonly pacedTrainCadenceInput: Locator;

  private readonly trainNameInput: Locator;

  private readonly trainInitialSpeedInput: Locator;

  private readonly trainTagsInput: Locator;

  private readonly addTrainButton: Locator;

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
    this.startTimeField = page.locator('#train-start-time');
    this.returnSimulationResultButton = page.getByTestId('return-simulation-result');
    this.trainCountInput = page.locator('#osrdconf-traincount');
    this.operationStudiesSettings = page.getByTestId('dropdown-sncf');
    this.userSettings = page.getByTestId('user-settings-btn');
    this.modalCloseButton = page.getByTestId('modal-close-button');
    this.pacedTrainSwitch = page.getByTestId('paced-train-switch');
    this.definePacedTrainCheckbox = page.locator('#define-paced-train');
    this.definePacedTrainCheckboxLabel = page.locator('label[for="define-paced-train"]');
    this.pacedTrainTimeRangeDurationInput = page.locator('#paced-train-time-range-duration');
    this.pacedTrainCadenceInput = page.locator('#paced-train-cadence');
    this.addTrainButton = page.getByTestId('add-train');
    this.trainNameInput = page.locator('#train-name');
    this.trainInitialSpeedInput = page.locator('#train-initial-speed');
    this.trainTagsInput = page.getByTestId('chips-input');

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

  // startTime is already in format ISO 8601
  async setFormattedStartTime(startTime: string) {
    await this.startTimeField.fill(startTime);
    await expect(this.startTimeField).toHaveValue(startTime);
  }

  async checkTimetableItemHasBeenAdded(translation: string) {
    await this.checkToastTitle(translation);
    await this.closeToastNotification();
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

  // TODO Paced train : remove this (and all related locator and data-testid) in https://github.com/OpenRailAssociation/osrd/issues/10791
  async checkPacedTrainSwitch() {
    await expect(this.operationStudiesSettings).toBeVisible();
    await this.operationStudiesSettings.click();

    await expect(this.userSettings).toBeVisible();
    await this.userSettings.click();

    await expect(this.pacedTrainSwitch).toBeVisible();
    await expect(this.pacedTrainSwitch).not.toBeChecked();
    await this.pacedTrainSwitch.click();
    await expect(this.pacedTrainSwitch).toBeChecked();

    await this.modalCloseButton.click();
  }

  async checkInputsAndButtons(translations: ManageTrainScheduleTranslations, date: string) {
    await expect(this.addTrainButton).toBeVisible();
    await expect(this.addTrainButton).toHaveText(translations.addTrainSchedule);
    await expect(this.definePacedTrainCheckboxLabel).toBeVisible();
    await expect(this.definePacedTrainCheckboxLabel).toHaveText(
      translations.pacedTrains.defineService
    );
    await expect(this.definePacedTrainCheckbox).not.toBeChecked();
    await expect(this.returnSimulationResultButton).toBeVisible();
    await expect(this.trainNameInput).toBeVisible();

    await expect(this.startTimeField).toBeVisible();
    const startTimeDate = new Date(await this.startTimeField.inputValue());
    const scenarioCreationDate = new Date(date);
    const isSameDate =
      startTimeDate.getFullYear() === scenarioCreationDate.getFullYear() &&
      startTimeDate.getMonth() === scenarioCreationDate.getMonth() &&
      startTimeDate.getDate() === scenarioCreationDate.getDate();
    expect(isSameDate).toBe(true);

    await expect(this.trainInitialSpeedInput).toBeVisible();
    await expect(this.trainInitialSpeedInput).toHaveValue('0');

    await expect(this.trainTagsInput).toBeVisible();
  }

  async checkTabs() {
    await expect(this.rollingStockTab).toBeVisible();
    await expect(this.routeTab).toBeVisible();
    await expect(this.timesAndStopsTab).toBeVisible();
    await expect(this.simulationSettingsTab).toBeVisible();

    await expect(this.rollingStockTab).toHaveClass(/active/);
    await this.verifyTabWarningPresence();
  }

  async checkPacedTrainModeAndVerifyInputs(translations: ManageTrainScheduleTranslations) {
    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.addTrainButton).toHaveText(translations.addPacedTrain);

    await expect(this.pacedTrainTimeRangeDurationInput).toBeVisible();
    await expect(this.pacedTrainTimeRangeDurationInput).toHaveValue(
      DEFAULT_PACED_TRAIN_SETTINGS.duration
    );

    await expect(this.pacedTrainCadenceInput).toBeVisible();
    await expect(this.pacedTrainCadenceInput).toHaveValue(DEFAULT_PACED_TRAIN_SETTINGS.step);
  }

  async testPacedTrainMode(translations: ManageTrainScheduleTranslations) {
    await this.setTimeRangeDuration(PACED_TRAIN_SETTINGS_TEST.duration);
    await this.setCadence(PACED_TRAIN_SETTINGS_TEST.step);
    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.addTrainButton).toHaveText(translations.addTrainSchedule);
    await expect(this.pacedTrainTimeRangeDurationInput).not.toBeVisible();
    await expect(this.pacedTrainCadenceInput).not.toBeVisible();

    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.addTrainButton).toHaveText(translations.addPacedTrain);

    await expect(this.pacedTrainTimeRangeDurationInput).toBeVisible();
    await expect(this.pacedTrainTimeRangeDurationInput).toHaveValue(
      PACED_TRAIN_SETTINGS_TEST.duration
    );

    await expect(this.pacedTrainCadenceInput).toBeVisible();
    await expect(this.pacedTrainCadenceInput).toHaveValue(PACED_TRAIN_SETTINGS_TEST.step);
  }

  async fillPacedTrainSettings({
    name,
    startTime,
    duration: pacedTrainDuration,
    step,
  }: PacedTrainDetails) {
    await this.definePacedTrainCheckboxLabel.click();
    await this.setTimeRangeDuration(pacedTrainDuration);
    await this.setCadence(step);
    await this.setTrainScheduleName(name);
    await this.setFormattedStartTime(startTime);
  }

  async setTimeRangeDuration(timeRangeDuration: string) {
    await this.pacedTrainTimeRangeDurationInput.fill(timeRangeDuration);
    await expect(this.pacedTrainTimeRangeDurationInput).toHaveValue(timeRangeDuration);
  }

  async setCadence(cadence: string) {
    await this.pacedTrainCadenceInput.fill(cadence);
    await expect(this.pacedTrainCadenceInput).toHaveValue(cadence);
  }

  async addTimetableItem() {
    await this.addTrainButton.click();
  }

  async setTrainScheduleName(name: string) {
    await this.trainNameInput.fill(name);
    await expect(this.trainNameInput).toHaveValue(name);
  }

  async checkNumberOfTrains(number: number) {
    await expect(this.trainTimetable).toHaveCount(number);
  }
}
export default OperationalStudiesPage;
