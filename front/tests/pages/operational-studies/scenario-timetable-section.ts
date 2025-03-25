import { type Locator, type Page, expect } from '@playwright/test';

import {
  EXPLICIT_UI_STABILITY_TIMEOUT,
  SIMULATION_RESULT_TIMEOUT,
} from '../../assets/constants/timeout-const';
import { getTranslations } from '../../utils';
import readJsonFile from '../../utils/file-utils';
import type {
  CommonTranslations,
  FlatTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';
import CommonPage from '../common-page';

type ScenarioTranslations = {
  timetable: FlatTranslations;
};

const enTranslations: ScenarioTranslations = readJsonFile(
  'public/locales/en/operationalStudies/scenario.json'
);
const frTranslations: ScenarioTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/scenario.json'
);

class ScenarioTimetableSection extends CommonPage {
  private readonly invalidTrainsMessage: Locator;

  private readonly timetableTrains: Locator;

  private readonly selectedTimetableTrain: Locator;

  // TODO: remove this commented code when the design of simulation bar has been changed
  // readonly simulationBar: Locator;

  private readonly manchetteSpaceTimeChart: Locator;

  private readonly spaceTimeChart: Locator;

  private readonly speedSpaceChart: Locator;

  readonly timesStopsDataSheet: Locator;

  private readonly simulationMap: Locator;

  private readonly timetableAllItemCheckbox: Locator;

  private readonly timetableTotalItemLabel: Locator;

  private readonly deleteAllTimetableItemsButton: Locator;

  private readonly confirmationModalDeleteButton: Locator;

  private readonly timetableFilterButton: Locator;

  private readonly timetableFilterButtonClose: Locator;

  private readonly timetableLabelFilterInputLabel: Locator;

  private readonly timetableLabelFilterInput: Locator;

  private readonly timetableRollingStockFilterInputLabel: Locator;

  private readonly timetableRollingStockFilterInput: Locator;

  private readonly timetableValidityFilterSelectLabel: Locator;

  private readonly timetableValidityFilterSelect: Locator;

  private readonly timetablePunctualityFilterSelectLabel: Locator;

  private readonly timetablePunctualityFilterSelect: Locator;

  private readonly timetableTrainTypeFilterSelectLabel: Locator;

  private readonly timetableTrainTypeFilterSelect: Locator;

  private readonly timetableSpeedLimitTagFilterLabel: Locator;

  private readonly editItemButton: Locator;

  private readonly editTrainScheduleButton: Locator;

  private readonly trainArrivalTime: Locator;

  private readonly scenarioCollapseButton: Locator;

  private readonly timetableCollapseButton: Locator;

  private readonly scenarioSideMenu: Locator;

  private readonly emptyTimetable: Locator;

  private readonly simulationResult: Locator;

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
    this.timetableAllItemCheckbox = page.locator('.train-count .checkmark');
    this.timetableTotalItemLabel = page.locator('.toolbar-header .label');
    this.deleteAllTimetableItemsButton = page.getByTestId('delete-all-items-button');
    this.confirmationModalDeleteButton = page.getByTestId('confirmation-modal-delete-button');
    this.timetableFilterButton = page.getByTestId('timetable-filter-button');
    this.timetableFilterButtonClose = page.getByTestId('timetable-filter-button-close');
    this.timetableLabelFilterInputLabel = page.locator('label[for="timetable-label-filter"]');
    this.timetableLabelFilterInput = page.locator('#timetable-label-filter');
    this.timetableRollingStockFilterInputLabel = page.locator(
      'label[for="timetable-rollingstock-filter"]'
    );
    this.timetableRollingStockFilterInput = page.locator('#timetable-rollingstock-filter');
    this.timetableValidityFilterSelectLabel = page.locator(
      'label[for="timetable-train-validity-filter"]'
    );
    this.timetableValidityFilterSelect = page.locator('#timetable-train-validity-filter');
    this.timetablePunctualityFilterSelectLabel = page.locator(
      'label[for="timetable-train-punctuality-filter"]'
    );
    this.timetablePunctualityFilterSelect = page.locator('#timetable-train-punctuality-filter');
    this.timetableTrainTypeFilterSelectLabel = page.locator(
      'label[for="timetable-train-type-filter"]'
    );
    this.timetableTrainTypeFilterSelect = page.locator('#timetable-train-type-filter');
    this.timetableSpeedLimitTagFilterLabel = page.locator(
      'label[for="timetable-speed-limit-tag-filter"]'
    );
    this.editItemButton = page.getByTestId('edit-item');
    this.editTrainScheduleButton = page.getByTestId('submit-edit-train-schedule');
    this.trainArrivalTime = page.locator('.train-time').getByTestId('train-arrival-time');
    this.scenarioCollapseButton = page.getByTestId('scenario-collapse-button');
    this.timetableCollapseButton = page.getByTestId('timetable-collapse-button');
    this.scenarioSideMenu = page.getByTestId('scenario-sidemenu');
    this.emptyTimetable = page.locator('.empty-list');
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

  async checkTimetableFilterVisibilityLabelDefaultValue(
    translation: FlatTranslations,
    {
      inputDefaultValue,
      selectDefaultValue,
    }: { inputDefaultValue: string; selectDefaultValue: string }
  ): Promise<void> {
    await this.timetableFilterButton.click();

    await expect(this.timetableLabelFilterInputLabel).toBeVisible();
    await expect(this.timetableLabelFilterInputLabel).toHaveText(translation.filterLabel);
    await expect(this.timetableLabelFilterInput).toBeVisible();
    await expect(this.timetableLabelFilterInput).toHaveValue(inputDefaultValue);

    await expect(this.timetableRollingStockFilterInputLabel).toBeVisible();
    await expect(this.timetableRollingStockFilterInputLabel).toHaveText(
      translation.advancedFilterLabel
    );
    await expect(this.timetableRollingStockFilterInput).toBeVisible();
    await expect(this.timetableRollingStockFilterInput).toHaveValue(inputDefaultValue);

    await expect(this.timetableValidityFilterSelectLabel).toBeVisible();
    await expect(this.timetableValidityFilterSelectLabel).toHaveText(translation.validityFilter);
    await expect(this.timetableValidityFilterSelect).toBeVisible();
    await expect(this.timetableValidityFilterSelect).toHaveValue(selectDefaultValue);

    await expect(this.timetablePunctualityFilterSelectLabel).toBeVisible();
    await expect(this.timetablePunctualityFilterSelectLabel).toHaveText(translation.punctuality);
    await expect(this.timetablePunctualityFilterSelect).toBeVisible();
    await expect(this.timetablePunctualityFilterSelect).toHaveValue(selectDefaultValue);

    await expect(this.timetableTrainTypeFilterSelectLabel).toBeVisible();
    await expect(this.timetableTrainTypeFilterSelectLabel).toHaveText(translation.trainType);
    await expect(this.timetableTrainTypeFilterSelect).toBeVisible();
    await expect(this.timetableTrainTypeFilterSelect).toHaveValue(selectDefaultValue);

    await expect(this.timetableSpeedLimitTagFilterLabel).toBeVisible();
    await expect(this.timetableSpeedLimitTagFilterLabel).toHaveText(translation.speedLimitTags);

    await this.timetableFilterButtonClose.click();
  }

  // Click the train validity filter button based on the provided translation
  async clickValidityTrainFilterButton(filterTranslation: string): Promise<void> {
    await this.timetableValidityFilterSelect.selectOption({ label: filterTranslation });
  }

  // Click the train honored filter button based on the provided translation
  async clickHonoredTrainFilterButton(filterTranslation: string): Promise<void> {
    await this.timetablePunctualityFilterSelect.selectOption({ label: filterTranslation });
  }

  // Click the train type filter button based on the provided translation
  async clickTrainTypeFilterButton(filterTranslation: string): Promise<void> {
    await this.timetableTrainTypeFilterSelect.selectOption({ label: filterTranslation });
  }

  // Verify that the imported train number is correct
  async verifyTrainCount(trainCount: number): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await expect(this.timetableTrains).toHaveCount(trainCount);
  }

  // Verify that the total items label matches the expected syntax (plural only)
  async verifyTotalItemsLabel(
    translations: TimetableFilterTranslations & CommonTranslations,
    itemCounts: {
      totalPacedTrainCount: number;
      totalTrainScheduleCount: number;
    }
  ): Promise<void> {
    const { totalPacedTrainCount, totalTrainScheduleCount } = itemCounts;
    await expect(this.timetableTotalItemLabel).toBeVisible();

    // Total items label has the syntax : "X services and Y trains"
    const pacedTrainLabel = translations.pacedTrain_other
      .split(' ')[1]
      .slice(0, totalPacedTrainCount > 1 ? undefined : -1); // "services"
    const trainScheduleLabel = translations.train_other
      .split(' ')[1]
      .slice(0, totalTrainScheduleCount > 1 ? undefined : -1); // "trains"

    let expectedComputedLabel = `${totalPacedTrainCount} ${pacedTrainLabel} ${translations.common.and} ${totalTrainScheduleCount} ${trainScheduleLabel}`;
    if (totalPacedTrainCount === 0) {
      expectedComputedLabel = `${totalTrainScheduleCount} ${trainScheduleLabel}`;
    } else if (totalTrainScheduleCount === 0) {
      expectedComputedLabel = `${totalPacedTrainCount} ${pacedTrainLabel}`;
    }
    await expect(this.timetableTotalItemLabel).toHaveText(expectedComputedLabel);
  }

  async filterNameAndVerifyTrainCount(name: string, expectedTrainCount: number) {
    await this.timetableFilterButton.click();
    await this.timetableLabelFilterInput.fill(name);
    await this.verifyTrainCount(expectedTrainCount);
    await this.timetableLabelFilterInput.clear();
    await this.timetableFilterButtonClose.click();
  }

  async filterRollingStockAndVerifyTrainCount(name: string, expectedTrainCount: number) {
    await this.timetableFilterButton.click();
    await this.timetableRollingStockFilterInput.fill(name);
    await this.verifyTrainCount(expectedTrainCount);
    await this.timetableRollingStockFilterInput.clear();
    await this.timetableFilterButtonClose.click();
  }

  // Filter trains validity and verify their count
  async filterValidityAndVerifyTrainCount(
    validityFilter: 'Valid' | 'Invalid' | 'All',
    expectedTrainCount: number,
    translations: TimetableFilterTranslations
  ): Promise<void> {
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
    expectedTrainCount: number,
    translations: TimetableFilterTranslations
  ): Promise<void> {
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

  // Filter the train type and verify their count
  async filterTrainTypeAndVerifyTrainCount(
    trainTypeFilter: 'Service' | 'Unique train' | 'All',
    expectedTrainCount: number
  ): Promise<void> {
    const translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
    await this.timetableFilterButton.click();

    const trainTypeFilters = {
      Service: translations.timetable.pacedTrain,
      'Unique train': translations.timetable.trainSchedule,
      All: translations.timetable.showAllTrains,
    };

    await this.clickTrainTypeFilterButton(trainTypeFilters[trainTypeFilter]);
    await this.timetableFilterButtonClose.click();
    await this.verifyTrainCount(expectedTrainCount);
  }

  // Filter train using speed limit tag button based on the provided translation and verify train count
  async filterSpeedLimitTagAndVerifyTrainCount(
    filterTranslation: string | null,
    expectedTrainCount: number,
    translations: TimetableFilterTranslations
  ): Promise<void> {
    await this.timetableFilterButton.click();

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

  // Iterate over each train element and verify the visibility of simulation results
  async verifyEachTrainSimulation(): Promise<void> {
    const trainCount = await this.timetableTrains.count();

    for (let currentTrainIndex = 0; currentTrainIndex < trainCount; currentTrainIndex += 1) {
      await this.page.waitForLoadState();
      await this.simulationResult.waitFor();
      const trainButton = ScenarioTimetableSection.getTrainButton(
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

  async clickOnEditTrain(index: number = 0) {
    await this.timetableTrains.nth(index).click();
    await this.editItemButton.nth(index).click();
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

  async selectAllTimetableItems(
    translations: TimetableFilterTranslations & CommonTranslations,
    itemCounts: {
      totalPacedTrainCount: number;
      totalTrainScheduleCount: number;
    }
  ) {
    await this.timetableAllItemCheckbox.click();

    const { totalPacedTrainCount, totalTrainScheduleCount } = itemCounts;
    await expect(this.timetableTotalItemLabel).toBeVisible();

    // Rebuild the expected text for total items label which has the syntax : "X/X services and Y/Y trains selected"
    const trainTypeTranslation = translations.timetable.trainType; // format "Services, trains"
    const [pacedTrains, trains] = trainTypeTranslation.split(', '); // expect to return ["Services", "trains"]
    const pacedTrainAndTrainCountTrad = translations.pacedTrainAndTrainCount; // finished by "selected"
    const selectedTrad = pacedTrainAndTrainCountTrad.split(' ').at(-1); // expect to return "selected"
    const expectedComputedLabel = `${totalPacedTrainCount}/${totalPacedTrainCount} ${pacedTrains.toLowerCase()} ${translations.common.and} ${totalTrainScheduleCount}/${totalTrainScheduleCount} ${trains} ${selectedTrad}`;
    await expect(this.timetableTotalItemLabel).toHaveText(expectedComputedLabel);
  }

  async deleteAllTimetableItems() {
    await expect(this.deleteAllTimetableItemsButton).toBeVisible();
    await this.deleteAllTimetableItemsButton.click();

    await expect(this.confirmationModalDeleteButton).toBeVisible();
    await this.confirmationModalDeleteButton.click();
  }

  async verifyAllTimetableItemsHaveBeenDeleted(
    itemsCount: number,
    translations: TimetableFilterTranslations
  ) {
    // translation has format "The {{count}} items have been deleted.";
    const [firstPart, secondPart] =
      translations.timetable.itemsSelectionDeletedCount_other.split('{{count}}');
    const expectedDeleteToast = `${firstPart}${itemsCount}${secondPart}`;
    await this.checkToastTitle(expectedDeleteToast);

    await this.closeToastNotification();
  }

  async verifyTimetableIsEmpty(translation: string) {
    await expect(this.emptyTimetable).toBeVisible();
    await expect(this.timetableTotalItemLabel).toHaveText(translation);
  }
}

export default ScenarioTimetableSection;
