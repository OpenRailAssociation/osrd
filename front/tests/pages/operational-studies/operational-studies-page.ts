import { expect, type Locator, type Page } from '@playwright/test';

import { Duration } from 'utils/duration';

import ScenarioTimetableSection from './scenario-timetable-section';
import {
  DEFAULT_PACED_TRAIN_SETTINGS,
  PACED_TRAIN_SETTINGS_TEST,
} from '../../assets/constants/operational-studies-const';
import { createDateInSpecialTimeZone } from '../../utils/date-utils';
import type { ManageTimetableItemTranslations, PacedTrainDetails } from '../../utils/types';

class OperationalStudiesPage extends ScenarioTimetableSection {
  private readonly addTimetableItemButton: Locator;

  private readonly manageTimetableItemPage: Locator;

  private readonly rollingStockTab: Locator;

  private readonly routeTab: Locator;

  private readonly startTimeField: Locator;

  private readonly resultPathfindingDistance: Locator;

  private readonly returnSimulationResultButton: Locator;

  private readonly definePacedTrainCheckbox: Locator;

  private readonly definePacedTrainCheckboxLabel: Locator;

  private readonly pacedTrainTimeWindow: Locator;

  private readonly pacedTrainIntervalInput: Locator;

  private readonly pacedTrainAddException: {
    label: Locator;
    dateInput: Locator;
    timeInput: Locator;
    button: Locator;
    list: Locator;
  };

  private readonly timetableItemNameInput: Locator;

  private readonly initialSpeedInput: Locator;

  private readonly timetableItemTagsInput: Locator;

  private readonly createTimetableItemButton: Locator;

  private readonly simulationSettingsTab: Locator;

  private readonly timesAndStopsTab: Locator;

  constructor(page: Page) {
    super(page);
    this.resultPathfindingDistance = page.getByTestId('result-pathfinding-distance');
    this.addTimetableItemButton = page.getByTestId('scenarios-add-timetable-item-button');
    this.rollingStockTab = page.getByTestId('tab-rollingstock');
    this.routeTab = page.getByTestId('tab-pathfinding');
    this.simulationSettingsTab = page.getByTestId('tab-simulation-settings');
    this.timesAndStopsTab = page.getByTestId('tab-timesStops');
    this.startTimeField = page.getByTestId('start-time-input');
    this.returnSimulationResultButton = page.getByTestId('return-simulation-result');
    this.definePacedTrainCheckbox = page.getByTestId('define-paced-train-checkbox');
    this.definePacedTrainCheckboxLabel = page.locator('label[for="define-paced-train"]');
    this.pacedTrainTimeWindow = page.getByTestId('paced-train-time-window-input');
    this.pacedTrainIntervalInput = page.getByTestId('paced-train-interval-input');
    this.pacedTrainAddException = {
      label: page.getByTestId('added-occurrences'),
      dateInput: page.getByTestId('added-occurrences-date-input'),
      timeInput: page.getByTestId('added-occurrences-time-input'),
      button: page.getByTestId('added-occurrences-add-button'),
      list: page.getByTestId('added-occurrences-list'),
    };
    this.createTimetableItemButton = page.getByTestId('create-timetable-item-button');
    this.manageTimetableItemPage = page.getByTestId('manage-timetable-item');
    this.timetableItemNameInput = page.getByTestId('timetable-item-name-input');
    this.initialSpeedInput = page.getByTestId('initial-speed-input');
    this.timetableItemTagsInput = page.getByTestId('chips-input');
  }

  // Click on the button to add a scenario timetable item.
  async openTimetableItemForm() {
    await this.timetableBoardWrapperMenuButton.click();
    await this.addTimetableItemButton.click();
    await expect(this.manageTimetableItemPage).toBeVisible();
  }

  async openRouteTab() {
    await this.routeTab.click();
  }

  async openTimesAndStopsTab() {
    await this.timesAndStopsTab.click();
  }

  async openSimulationSettingsTab() {
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

  async setTimetableItemStartTime(departureTime: string, departureDate?: string) {
    const currentDate = departureDate || new Date().toISOString().split('T')[0];
    const startTime = `${currentDate}T${departureTime}`;
    await expect(this.startTimeField).toBeVisible();
    await this.startTimeField.fill(startTime);
    await this.startTimeField.dispatchEvent('blur');
    await expect(this.startTimeField).toHaveValue(startTime);
  }

  // startTime is already in format ISO 8601
  async setFormattedStartTime(startTime: string) {
    await this.startTimeField.fill(startTime);
    await expect(this.startTimeField).toHaveValue(startTime);
  }

  async returnSimulationResult() {
    await this.returnSimulationResultButton.click();
  }

  async submitTimetableItemEdit() {
    await this.editTimetableItemButton.click();
    await expect(this.returnSimulationResultButton).not.toBeVisible();
    await this.closeToastNotification();
  }

  async checkPathfindingDistance(distance: string | RegExp) {
    await expect(this.resultPathfindingDistance).toBeVisible();
    await expect(this.resultPathfindingDistance).toHaveText(distance);
  }

  async checkInputsAndButtons(translations: ManageTimetableItemTranslations, date: string) {
    await expect(this.createTimetableItemButton).toBeVisible();
    await expect(this.createTimetableItemButton).toHaveText(translations.addTrainSchedule);
    await expect(this.definePacedTrainCheckboxLabel).toBeVisible();
    await expect(this.definePacedTrainCheckboxLabel).toHaveText(
      translations.pacedTrains.defineService
    );
    await expect(this.definePacedTrainCheckbox).not.toBeChecked();
    await expect(this.returnSimulationResultButton).toBeVisible();
    await expect(this.timetableItemNameInput).toBeVisible();
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

    await expect(this.initialSpeedInput).toBeVisible();
    await expect(this.initialSpeedInput).toHaveValue('0');

    await expect(this.timetableItemTagsInput).toBeVisible();
  }

  async updateTimetableItem(expectedButtonText?: string) {
    if (expectedButtonText) {
      await expect(this.editTimetableItemButton).toHaveText(expectedButtonText);
    }
    await this.submitTimetableItemEdit();
  }

  async turnTrainScheduleIntoPacedTrain(translations: ManageTimetableItemTranslations) {
    await expect(this.definePacedTrainCheckbox).not.toBeChecked();
    await expect(this.editTimetableItemButton).toBeVisible();
    await expect(this.editTimetableItemButton).toHaveText(translations.updateTrainSchedule);

    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.definePacedTrainCheckbox).toBeChecked();
    await expect(this.editTimetableItemButton).toHaveText(
      translations.turnTrainScheduleIntoPacedTrain
    );

    await this.submitTimetableItemEdit();
  }

  async turnPacedTrainIntoTrainSchedule(translations: ManageTimetableItemTranslations) {
    await expect(this.definePacedTrainCheckbox).toBeChecked();
    await expect(this.editTimetableItemButton).toBeVisible();
    await expect(this.editTimetableItemButton).toHaveText(translations.updatePacedTrain);

    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.definePacedTrainCheckbox).not.toBeChecked();
    await expect(this.editTimetableItemButton).toHaveText(
      translations.turnPacedTrainIntoTrainSchedule
    );

    await this.submitTimetableItemEdit();
  }

  async checkTabs() {
    await expect(this.rollingStockTab).toBeVisible();
    await expect(this.routeTab).toBeVisible();
    await expect(this.timesAndStopsTab).toBeVisible();
    await expect(this.simulationSettingsTab).toBeVisible();

    await expect(this.rollingStockTab).toHaveClass(/active/);
    await this.verifyTabWarningPresence();
  }

  async checkPacedTrainModeAndVerifyInputs(translations: ManageTimetableItemTranslations) {
    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.createTimetableItemButton).toHaveText(translations.addPacedTrain);

    await this.checkTimeWindowValue(DEFAULT_PACED_TRAIN_SETTINGS.timeWindow);
    await this.checkIntervalValue(DEFAULT_PACED_TRAIN_SETTINGS.interval);
  }

  private async checkTimeWindowValue(value: string) {
    await expect(this.pacedTrainTimeWindow).toBeVisible();
    await expect(this.pacedTrainTimeWindow).toHaveValue(value);
  }

  private async checkIntervalValue(value: string) {
    await expect(this.pacedTrainIntervalInput).toBeVisible();
    await expect(this.pacedTrainIntervalInput).toHaveValue(value);
  }

  async testPacedTrainMode(translations: ManageTimetableItemTranslations) {
    await this.setTimeWindow(PACED_TRAIN_SETTINGS_TEST.timeWindow);
    await this.setInterval(PACED_TRAIN_SETTINGS_TEST.interval);
    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.createTimetableItemButton).toHaveText(translations.addTrainSchedule);
    await expect(this.pacedTrainTimeWindow).not.toBeVisible();
    await expect(this.pacedTrainIntervalInput).not.toBeVisible();

    await this.definePacedTrainCheckboxLabel.click();
    await expect(this.createTimetableItemButton).toHaveText(translations.addPacedTrain);

    await expect(this.pacedTrainTimeWindow).toBeVisible();
    await expect(this.pacedTrainTimeWindow).toHaveValue(PACED_TRAIN_SETTINGS_TEST.timeWindow);

    await expect(this.pacedTrainIntervalInput).toBeVisible();
    await expect(this.pacedTrainIntervalInput).toHaveValue(PACED_TRAIN_SETTINGS_TEST.interval);
  }

  async fillPacedTrainSettings({ name, startTime, timeWindow, interval }: PacedTrainDetails) {
    await this.definePacedTrainCheckboxLabel.click();
    await this.setTimeWindow(timeWindow);
    await this.setInterval(interval);
    await this.setTimetableItemName(name);
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

  async createTimetableItem() {
    await this.createTimetableItemButton.click();
  }

  async setTimetableItemName(name: string) {
    await this.timetableItemNameInput.fill(name);
    await expect(this.timetableItemNameInput).toHaveValue(name);
  }

  async checkInputsBeforeEditingAPacedTrain(
    translations: ManageTimetableItemTranslations,
    editedPacedTrainTimeWindow: string,
    editedPacedTrainInterval: string
  ) {
    await expect(this.definePacedTrainCheckbox).toBeChecked();
    await this.checkTimeWindowValue(
      String(Duration.parse(editedPacedTrainTimeWindow).total('minute'))
    );
    await this.checkIntervalValue(String(Duration.parse(editedPacedTrainInterval).total('minute')));

    await expect(this.pacedTrainAddException.label).toContainText(
      translations.pacedTrains.addExtraOccurrences
    );
    await expect(this.pacedTrainAddException.dateInput).toBeVisible();
    await expect(this.pacedTrainAddException.timeInput).toBeVisible();
    await expect(this.pacedTrainAddException.button).toBeVisible();
    await expect(this.returnSimulationResultButton).toBeVisible();
  }

  async checkEditOccurrenceButtonsVisibility() {
    await expect(this.editTimetableItemButton).toBeVisible();
    await expect(this.returnSimulationResultButton).toBeVisible();
  }

  async createPacedTrainException(date: string, time: string) {
    await this.pacedTrainAddException.dateInput.fill(date);
    await this.pacedTrainAddException.timeInput.fill(time);
    await this.pacedTrainAddException.button.click();
    const expected = new Date(`${date}T${time}`).toLocaleDateString('fr-FR');
    await expect(this.pacedTrainAddException.list).toContainText(expected);
  }
}
export default OperationalStudiesPage;
