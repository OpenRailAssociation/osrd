import { expect, type Locator, type Page } from '@playwright/test';

import {
  DEFAULT_PACED_TRAIN_SETTINGS,
  PACED_TRAIN_SETTINGS_TEST,
} from '../../assets/constants/operational-studies-const';
import { createDateInSpecialTimeZone } from '../../utils/date-utils';
import type { ManageTrainScheduleTranslations, PacedTrainDetails } from '../../utils/types';
import CommonPage from '../common-page';

class OperationalStudiesPage extends CommonPage {
  private readonly addScenarioTrainButton: Locator;

  private readonly editTrainButton: Locator;

  private readonly manageTrainSchedulePage: Locator;

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

  private readonly pacedTrainTimeWindow: Locator;

  private readonly pacedTrainIntervalInput: Locator;

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
    this.pacedTrainTimeWindow = page.locator('#paced-train-time-window');
    this.pacedTrainIntervalInput = page.locator('#paced-train-interval');
    this.addTrainButton = page.getByTestId('add-train');
    this.editTrainButton = page.getByTestId('submit-edit-train-schedule');
    this.manageTrainSchedulePage = page.getByTestId('manage-train-schedule');
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
    await expect(this.manageTrainSchedulePage).toBeVisible();
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

  async checkToastHasBeenLaunched(translation: string) {
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
    const startTimeDate = createDateInSpecialTimeZone(
      await this.startTimeField.inputValue(),
      'Europe/Paris'
    ).toDate();
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

  async updateTimetableItem(expectedButtonText?: string) {
    if (expectedButtonText) {
      await expect(this.editTrainButton).toHaveText(expectedButtonText);
    }
    await this.editTrainButton.click();
  }

  async turnTrainScheduleIntoPacedTrain(translations: ManageTrainScheduleTranslations) {
    await expect(this.definePacedTrainCheckbox).not.toBeChecked();
    await expect(this.editTrainButton).toBeVisible();
    await expect(this.editTrainButton).toHaveText(translations.updateTrainSchedule);

    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.definePacedTrainCheckbox).toBeChecked();
    await expect(this.editTrainButton).toHaveText(translations.turnTrainScheduleIntoPacedTrain);

    await this.editTrainButton.click();
  }

  async turnPacedTrainIntoTrainSchedule(translations: ManageTrainScheduleTranslations) {
    await expect(this.definePacedTrainCheckbox).toBeChecked();
    await expect(this.editTrainButton).toBeVisible();
    await expect(this.editTrainButton).toHaveText(translations.updatePacedTrain);

    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.definePacedTrainCheckbox).not.toBeChecked();
    await expect(this.editTrainButton).toHaveText(translations.turnPacedTrainIntoTrainSchedule);

    await this.editTrainButton.click();
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

    await expect(this.pacedTrainTimeWindow).toBeVisible();
    await expect(this.pacedTrainTimeWindow).toHaveValue(DEFAULT_PACED_TRAIN_SETTINGS.timeWindow);

    await expect(this.pacedTrainIntervalInput).toBeVisible();
    await expect(this.pacedTrainIntervalInput).toHaveValue(DEFAULT_PACED_TRAIN_SETTINGS.interval);
  }

  async testPacedTrainMode(translations: ManageTrainScheduleTranslations) {
    await this.setTimeWindow(PACED_TRAIN_SETTINGS_TEST.timeWindow);
    await this.setInterval(PACED_TRAIN_SETTINGS_TEST.interval);
    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.addTrainButton).toHaveText(translations.addTrainSchedule);
    await expect(this.pacedTrainTimeWindow).not.toBeVisible();
    await expect(this.pacedTrainIntervalInput).not.toBeVisible();

    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.addTrainButton).toHaveText(translations.addPacedTrain);

    await expect(this.pacedTrainTimeWindow).toBeVisible();
    await expect(this.pacedTrainTimeWindow).toHaveValue(PACED_TRAIN_SETTINGS_TEST.timeWindow);

    await expect(this.pacedTrainIntervalInput).toBeVisible();
    await expect(this.pacedTrainIntervalInput).toHaveValue(PACED_TRAIN_SETTINGS_TEST.interval);
  }

  async fillPacedTrainSettings({ name, startTime, timeWindow, interval }: PacedTrainDetails) {
    await this.definePacedTrainCheckboxLabel.click();
    await this.setTimeWindow(timeWindow);
    await this.setInterval(interval);
    await this.setTrainScheduleName(name);
    await this.setFormattedStartTime(startTime);
  }

  async setTimeWindow(timeWindow: string) {
    await this.pacedTrainTimeWindow.fill(timeWindow);
    await expect(this.pacedTrainTimeWindow).toHaveValue(timeWindow);
  }

  async setInterval(interval: string) {
    await this.pacedTrainIntervalInput.fill(interval);
    await expect(this.pacedTrainIntervalInput).toHaveValue(interval);
  }

  async addTimetableItem() {
    await this.addTrainButton.click();
  }

  async setTrainScheduleName(name: string) {
    await this.trainNameInput.fill(name);
    await expect(this.trainNameInput).toHaveValue(name);

    // we need to wait, because the input has a debounce of 500ms
    // TODO: remove this when the debounce is removed (https://github.com/OpenRailAssociation/osrd/issues/11294)
    await this.page.waitForTimeout(600);
  }

  async checkNumberOfTrains(number: number) {
    await expect(this.trainTimetable).toHaveCount(number);
  }
}
export default OperationalStudiesPage;
