import { type Locator, type Page, expect } from '@playwright/test';

import { readJsonFile } from '../../utils/file-utils';
import type {
  CommonTranslations,
  FlatTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';
import PacedTrainSection from './paced-train-section';
import OpSimulationResultPage from './simulation-results-page';

type ScenarioTranslations = {
  timetable: FlatTranslations;
};

const frTranslations: ScenarioTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

class ScenarioTimetableSection extends OpSimulationResultPage {
  private readonly invalidTrainSchedulesMessage: Locator;
  private readonly trainSchedules: Locator;
  private readonly timetableBoardWrapper: Locator;
  private readonly timetableSelectAllButton: Locator;
  private readonly timetableSelectOptionsButton: Locator;
  private readonly timetableTotalTrainLabel: Locator;
  private readonly deleteAllTrainsButton: Locator;
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
  private readonly editTrainButton: Locator;
  private readonly projectTrainButton: Locator;
  private readonly deleteTrainButton: Locator;
  readonly editTrainScheduleButton: Locator;
  private readonly trainScheduleArrivalTime: Locator;
  private readonly trainScheduleArrivalTimeLoader: Locator;
  private readonly invalidTrainSchedulesReasons: Locator;
  private readonly unselectTrainSchedulesButton: Locator;
  readonly exportTrainScheduleButton: Locator;
  private readonly trainName: Locator;
  readonly itineraryModal: Locator;
  readonly closeItineraryModalButton: Locator;

  constructor(page: Page) {
    super(page);
    this.invalidTrainSchedulesMessage = page.getByTestId('invalid-train-schedule-message');
    this.trainSchedules = page.getByTestId('scenario-train-schedule');
    this.timetableBoardWrapper = page.getByTestId('timetable-board-wrapper');
    this.timetableTotalTrainLabel = this.timetableBoardWrapper.getByTestId('board-header-name');
    this.timetableSelectAllButton = page.getByTestId('scenarios-select-all-button');
    this.timetableSelectOptionsButton = page.getByTestId('scenarios-select-options-button');
    this.deleteAllTrainsButton = page.getByTestId('delete-all-trains-button');
    this.confirmationModalDeleteButton = page.getByTestId('confirmation-modal-delete-button');
    this.timetableFilterButton = page.getByTestId('timetable-filter-button');
    this.timetableFilterButtonClose = page.getByTestId('timetable-filter-button-close');
    this.timetableLabelFilterInputLabel = page.locator('label[for="timetable-label-filter"]');
    this.timetableLabelFilterInput = page.getByTestId('timetable-label-filter-input');
    this.timetableRollingStockFilterInputLabel = page.locator(
      'label[for="timetable-rollingstock-filter"]'
    );
    this.timetableRollingStockFilterInput = page.getByTestId('timetable-rollingstock-filter-input');
    this.timetableValidityFilterSelectLabel = page.locator(
      'label[for="timetable-train-validity-filter"]'
    );
    this.timetableValidityFilterSelect = page.getByTestId('timetable-train-validity-filter');
    this.timetablePunctualityFilterSelectLabel = page.locator(
      'label[for="timetable-train-punctuality-filter"]'
    );
    this.timetablePunctualityFilterSelect = page.getByTestId('timetable-train-punctuality-filter');
    this.timetableTrainTypeFilterSelectLabel = page.locator(
      'label[for="timetable-train-type-filter"]'
    );
    this.timetableTrainTypeFilterSelect = page.getByTestId('timetable-train-type-filter');
    this.timetableSpeedLimitTagFilterLabel = page.getByTestId(
      'timetable-speed-limit-tag-filter-label'
    );
    this.editTrainButton = page.getByTestId('edit-train');
    this.projectTrainButton = page.getByTestId('project-train');
    this.deleteTrainButton = page.getByTestId('delete-train');
    this.editTrainScheduleButton = page.getByTestId('submit-edit-train-schedule');
    this.trainScheduleArrivalTime = page.getByTestId('train-schedule-arrival-time');
    this.trainScheduleArrivalTimeLoader = page.getByTestId('arrival-time-loader');
    this.invalidTrainSchedulesReasons = this.trainSchedules.getByTestId('invalid-reason');
    this.exportTrainScheduleButton = page.getByTestId('export-selection-button');
    this.unselectTrainSchedulesButton = page.getByTestId('scenarios-unselect-all-button');
    this.trainName = page.getByTestId('train-name');
    this.itineraryModal = page.getByTestId('itinerary-modal');
    this.closeItineraryModalButton = page.getByTestId('close-itinerary-modal');
  }

  private static getUniqueTrainButton(UniqueTrainSelector: Locator): Locator {
    return UniqueTrainSelector.getByTestId('scenario-timetable-unique-train-button');
  }

  static getPacedTrainButton(pacedTrainSelector: Locator): Locator {
    return pacedTrainSelector.getByTestId('paced-train-name');
  }

  static getOccurrences(pacedTrain: Locator): Locator {
    return pacedTrain.getByTestId('occurrence-item');
  }

  async verifyInvalidTrainsMessageVisibility(): Promise<void> {
    await expect(this.invalidTrainSchedulesMessage).toHaveText(
      frTranslations.timetable.invalidTrains
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

  private async selectTrainValidityFilter(filterTranslation: string): Promise<void> {
    await this.timetableValidityFilterSelect.selectOption({
      label: filterTranslation,
    });
  }

  private async selectTrainPunctualityFilter(filterTranslation: string): Promise<void> {
    await this.timetablePunctualityFilterSelect.selectOption({
      label: filterTranslation,
    });
  }

  private async selectTrainTypeFilter(filterTranslation: string): Promise<void> {
    await this.timetableTrainTypeFilterSelect.selectOption({
      label: filterTranslation,
    });
  }

  async verifyTrainSchedulesCount(trainSchedulesCount: number): Promise<void> {
    await expect(this.trainSchedules.first()).toBeVisible();
    await expect(this.trainSchedules).toHaveCount(trainSchedulesCount);
  }

  async verifyTotalTrainSchedulesLabel(
    translations: TimetableFilterTranslations & CommonTranslations,
    trainScheduleCounts: {
      totalPacedTrainCount: number;
      totalUniqueTrainCount: number;
    }
  ): Promise<void> {
    const { totalPacedTrainCount, totalUniqueTrainCount } = trainScheduleCounts;
    await expect(this.trainSchedules.first()).toBeVisible();
    await expect(this.timetableTotalTrainLabel).toBeVisible();

    // Total train schedule label has the syntax : "X services and Y trains"
    const pacedTrainLabel = translations.pacedTrain_other
      .split(' ')[1]
      .slice(0, totalPacedTrainCount > 1 ? undefined : -1); // "services"
    const uniqueTrainLabel = translations.train_other
      .split(' ')[1]
      .slice(0, totalUniqueTrainCount > 1 ? undefined : -1); // "trains"

    let expectedComputedLabel = `${totalPacedTrainCount} ${pacedTrainLabel}, ${totalUniqueTrainCount} ${uniqueTrainLabel}`;
    if (totalPacedTrainCount === 0) {
      expectedComputedLabel = `${totalUniqueTrainCount} ${uniqueTrainLabel}`;
    } else if (totalUniqueTrainCount === 0) {
      expectedComputedLabel = `${totalPacedTrainCount} ${pacedTrainLabel}`;
    }
    await expect(this.timetableTotalTrainLabel).toHaveText(expectedComputedLabel);
  }

  async filterNameAndVerifyTrainCount(name: string, expectedTrainCount: number) {
    await this.timetableFilterButton.click();
    await this.timetableLabelFilterInput.fill(name);
    await this.verifyTrainSchedulesCount(expectedTrainCount);
    await this.timetableLabelFilterInput.clear();
    await this.timetableFilterButtonClose.click();
  }

  async filterRollingStockAndVerifyTrainCount(name: string, expectedTrainCount: number) {
    await this.timetableFilterButton.click();
    await this.timetableRollingStockFilterInput.fill(name);
    await this.verifyTrainSchedulesCount(expectedTrainCount);
    await this.timetableRollingStockFilterInput.clear();
    await this.timetableFilterButtonClose.click();
  }

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

    await this.selectTrainValidityFilter(validityFilters[validityFilter]);
    await this.timetableFilterButtonClose.click();
    await this.verifyTrainSchedulesCount(expectedTrainCount);
  }

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

    await this.selectTrainPunctualityFilter(honoredFilters[honoredFilter]);
    await this.timetableFilterButtonClose.click();
    await this.verifyTrainSchedulesCount(expectedTrainCount);
  }

  async filterTrainTypeAndVerifyTrainCount(
    trainTypeFilter: 'Service' | 'Unique train' | 'All',
    expectedTrainCount: number
  ): Promise<void> {
    await this.timetableFilterButton.click();

    const trainTypeFilters = {
      Service: frTranslations.timetable.pacedTrain,
      'Unique train': frTranslations.timetable.uniqueTrain,
      All: frTranslations.timetable.showAllTrains,
    };

    await this.selectTrainTypeFilter(trainTypeFilters[trainTypeFilter]);
    await this.timetableFilterButtonClose.click();
    await this.verifyTrainSchedulesCount(expectedTrainCount);
  }

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
    await this.verifyTrainSchedulesCount(expectedTrainCount);
    await filterButtonLocator.click();
    await this.timetableFilterButtonClose.click();
  }

  // Iterate over each paced train occurrences and verify the visibility of simulation results
  async verifyPacedTrainSimulations(pacedTrainCount: number): Promise<void> {
    const pacedTrainSection = new PacedTrainSection(this.page);
    for (let pacedTrainIndex = 0; pacedTrainIndex < pacedTrainCount; pacedTrainIndex += 1) {
      const pacedTrain = this.trainSchedules.nth(pacedTrainIndex);
      await expect(pacedTrain).toBeVisible();

      await pacedTrainSection.expandPacedTrainOccurrenceList(pacedTrainIndex);

      const occurrences = ScenarioTimetableSection.getOccurrences(pacedTrain); // retrieves all occurrence for this mission

      const count = await occurrences.count();
      for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
        const occurrenceButton = occurrences.nth(occurrenceIndex);

        const isSelected = await occurrenceButton.evaluate((el) =>
          el.classList.contains('selected')
        );
        if (!isSelected) {
          await occurrenceButton.click();
        }

        await this.verifySimulationResultsVisibility();
      }

      await pacedTrainSection.collapsePacedTrainOccurrenceList(pacedTrainIndex);
    }
  }

  // Iterate over each unique train and verify the visibility of simulation results
  async verifyEachUniqueTrainSimulation(uniqueTrainCount: number): Promise<void> {
    await expect(this.trainSchedules.first()).toBeVisible();
    const trainSchedulesCount = await this.trainSchedules.count();
    for (
      let currentUniqueTrainIndex = uniqueTrainCount;
      currentUniqueTrainIndex < trainSchedulesCount;
      currentUniqueTrainIndex += 1
    ) {
      await this.projectTrain(currentUniqueTrainIndex);
      await this.verifySimulationResultsVisibility();
    }
  }

  // TODO: This function must be modified after we drop the old itinerary interface
  async editTrainSchedule(index = 0) {
    await expect(this.trainSchedules.nth(index)).toBeVisible();
    await this.trainSchedules.nth(index).click();
    await this.editTrainButton.nth(index).click();
    await expect(this.itineraryModal).toBeVisible();
    await this.closeItineraryModalButton.click();
  }

  async deleteTrainSchedule(index = 0) {
    await expect(this.trainSchedules.nth(index)).toBeVisible();
    await this.trainSchedules.nth(index).click();
    await this.deleteTrainButton.nth(index).click();
  }

  async projectTrain(index = 0) {
    const UniqueTrainButton = ScenarioTimetableSection.getUniqueTrainButton(
      this.trainSchedules.nth(index)
    );
    await expect(UniqueTrainButton).toBeVisible();
    // Click and hover near the left edge to avoid action buttons
    await UniqueTrainButton.click({ position: { x: 5, y: 5 } });
    await UniqueTrainButton.scrollIntoViewIfNeeded();
    await UniqueTrainButton.hover({ position: { x: 5, y: 5 } });
    await expect(this.projectTrainButton.nth(index)).toBeVisible();
    await this.projectTrainButton.nth(index).click();
  }

  async getTrainScheduleArrivalTime(expectedArrivalTime: string, index = 0) {
    await expect(this.trainScheduleArrivalTime.nth(index)).toBeVisible();
    await expect(this.trainScheduleArrivalTimeLoader).toBeHidden();
    await expect
      .poll(async () => await this.trainScheduleArrivalTime.nth(index).innerText(), {
        timeout: 30_000,
      })
      .toBe(expectedArrivalTime);
  }

  async selectAllTrainSchedules() {
    await this.timetableSelectAllButton.click();
    await expect(this.exportTrainScheduleButton).toBeVisible();
    await expect(this.unselectTrainSchedulesButton).toBeVisible();
    await expect(this.deleteAllTrainsButton).toBeVisible();
  }

  async selectAllTrainSchedulesAndVerifySelection(
    translations: TimetableFilterTranslations & CommonTranslations,
    trainCounts: {
      totalPacedTrainCount: number;
      totalUniqueTrainCount: number;
    }
  ) {
    await this.timetableSelectOptionsButton.click();
    await expect(this.timetableSelectAllButton).toBeVisible();
    await this.selectAllTrainSchedules();

    const { totalPacedTrainCount, totalUniqueTrainCount } = trainCounts;
    await expect(this.timetableTotalTrainLabel).toBeVisible();

    // Rebuild the expected text for total train schedules label which has the syntax : "X/X services and Y/Y trains selected"
    const trainTypeTranslation = translations.timetable.trainType; // format "Services, trains"
    const [pacedTrains, uniqueTrains] = trainTypeTranslation.split(', '); // expect to return ["Services", "trains"]
    const pacedTrainAndTrainCountTrad = translations.pacedTrainAndTrainCount; // finished by "selected"
    const selectedTrad = pacedTrainAndTrainCountTrad.split(' ').at(-1); // expect to return "selected"
    const expectedComputedLabel = `${totalPacedTrainCount}/${totalPacedTrainCount} ${pacedTrains.toLowerCase()}, ${totalUniqueTrainCount}/${totalUniqueTrainCount} ${uniqueTrains} ${selectedTrad}`;
    await expect(this.timetableTotalTrainLabel).toHaveText(expectedComputedLabel);
  }

  async deleteAllTrainSchedules() {
    await expect(this.deleteAllTrainsButton).toBeVisible();
    await this.deleteAllTrainsButton.click();

    await expect(this.confirmationModalDeleteButton).toBeVisible();
    await this.confirmationModalDeleteButton.click();
  }

  async verifyAllTrainSchedulesHaveBeenDeleted(
    trainSchedulesCount: number,
    translations: TimetableFilterTranslations
  ) {
    // translation has format "The {{count}} train schedules have been deleted.";
    const [firstPart, secondPart] =
      translations.timetable.trainSchedulesSelectionDeletedCount_other.split('{{count}}');
    const expectedDeleteToast = `${firstPart}${trainSchedulesCount}${secondPart}`;
    await this.checkToastTitle(expectedDeleteToast);

    await this.closeToastNotification();
  }

  async verifyTimetableIsEmpty(translation: string) {
    await expect(this.trainSchedules).toHaveCount(0);
    await expect(this.timetableTotalTrainLabel).toHaveText(translation);
  }

  async verifyEditTrainScheduleButtonVisibility() {
    await expect(this.editTrainScheduleButton).toBeVisible();
  }

  async verifyFirstTrainScheduleIsSelected() {
    const trainSchedule = this.trainSchedules.first();
    await expect(trainSchedule).toBeVisible();
    await expect(trainSchedule).toHaveClass(/selected/);
  }

  async verifyInvalidReasons(expectedReason: string[]): Promise<void> {
    await expect(this.invalidTrainSchedulesReasons.first()).toBeVisible();
    await expect(this.invalidTrainSchedulesReasons).toHaveText(expectedReason);
  }

  async verifyTrainColor(expectedColor: string, index = 0) {
    await expect(this.trainName.nth(index)).toBeVisible();
    await expect(this.trainName.nth(index)).toHaveCSS('color', expectedColor);
  }
}

export default ScenarioTimetableSection;
