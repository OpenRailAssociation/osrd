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
  private readonly invalidTimetableItemsMessage: Locator;
  private readonly timetableItems: Locator;
  private readonly timetableBoardWrapper: Locator;
  private readonly timetableSelectAllButton: Locator;
  private readonly timetableSelectOptionsButton: Locator;
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
  private readonly projectItemButton: Locator;
  private readonly deleteItemButton: Locator;
  readonly editTrainScheduleButton: Locator;
  private readonly timetableItemArrivalTime: Locator;
  private readonly timetableItemArrivalTimeLoader: Locator;
  private readonly invalidTimetableItemsReasons: Locator;
  private readonly unselectTTimetableItemsButton: Locator;
  readonly exportTimetableItemButton: Locator;
  private readonly trainName: Locator;

  constructor(page: Page) {
    super(page);
    this.invalidTimetableItemsMessage = page.getByTestId('invalid-timetable-item-message');
    this.timetableItems = page.getByTestId('scenario-timetable-item');
    this.timetableBoardWrapper = page.getByTestId('timetable-board-wrapper');
    this.timetableTotalItemLabel = this.timetableBoardWrapper.getByTestId('board-header-name');
    this.timetableSelectAllButton = page.getByTestId('scenarios-select-all-button');
    this.timetableSelectOptionsButton = page.getByTestId('scenarios-select-options-button');
    this.deleteAllTimetableItemsButton = page.getByTestId('delete-all-items-button');
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
    this.editItemButton = page.getByTestId('edit-item');
    this.projectItemButton = page.getByTestId('project-item');
    this.deleteItemButton = page.getByTestId('delete-item');
    this.editTrainScheduleButton = page.getByTestId('submit-edit-train-schedule');
    this.timetableItemArrivalTime = page.getByTestId('timetable-item-arrival-time');
    this.timetableItemArrivalTimeLoader = page.getByTestId('arrival-time-loader');
    this.invalidTimetableItemsReasons = this.timetableItems.getByTestId('invalid-reason');
    this.exportTimetableItemButton = page.getByTestId('export-selection-button');
    this.unselectTTimetableItemsButton = page.getByTestId('scenarios-unselect-all-button');
    this.trainName = page.getByTestId('train-name');
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
    await expect(this.invalidTimetableItemsMessage).toHaveText(
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
    await this.timetableValidityFilterSelect.selectOption({ label: filterTranslation });
  }

  private async selectTrainPunctualityFilter(filterTranslation: string): Promise<void> {
    await this.timetablePunctualityFilterSelect.selectOption({ label: filterTranslation });
  }

  private async selectTrainTypeFilter(filterTranslation: string): Promise<void> {
    await this.timetableTrainTypeFilterSelect.selectOption({ label: filterTranslation });
  }

  async verifyTimetableItemsCount(timetableItemsCount: number): Promise<void> {
    await expect(this.timetableItems.first()).toBeVisible();
    await expect(this.timetableItems).toHaveCount(timetableItemsCount);
  }

  async verifyTotalItemsLabel(
    translations: TimetableFilterTranslations & CommonTranslations,
    itemCounts: {
      totalPacedTrainCount: number;
      totalUniqueTrainCount: number;
    }
  ): Promise<void> {
    const { totalPacedTrainCount, totalUniqueTrainCount } = itemCounts;
    await expect(this.timetableItems.first()).toBeVisible();
    await expect(this.timetableTotalItemLabel).toBeVisible();

    // Total items label has the syntax : "X services and Y trains"
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
    await expect(this.timetableTotalItemLabel).toHaveText(expectedComputedLabel);
  }

  async filterNameAndVerifyTrainCount(name: string, expectedTrainCount: number) {
    await this.timetableFilterButton.click();
    await this.timetableLabelFilterInput.fill(name);
    await this.verifyTimetableItemsCount(expectedTrainCount);
    await this.timetableLabelFilterInput.clear();
    await this.timetableFilterButtonClose.click();
  }

  async filterRollingStockAndVerifyTrainCount(name: string, expectedTrainCount: number) {
    await this.timetableFilterButton.click();
    await this.timetableRollingStockFilterInput.fill(name);
    await this.verifyTimetableItemsCount(expectedTrainCount);
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
    await this.verifyTimetableItemsCount(expectedTrainCount);
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
    await this.verifyTimetableItemsCount(expectedTrainCount);
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
    await this.verifyTimetableItemsCount(expectedTrainCount);
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
    await this.verifyTimetableItemsCount(expectedTrainCount);
    await filterButtonLocator.click();
    await this.timetableFilterButtonClose.click();
  }

  // Iterate over each paced train occurrences and verify the visibility of simulation results
  async verifyPacedTrainSimulations(pacedTrainCount: number): Promise<void> {
    const pacedTrainSection = new PacedTrainSection(this.page);
    for (let pacedTrainIndex = 0; pacedTrainIndex < pacedTrainCount; pacedTrainIndex += 1) {
      const pacedTrain = this.timetableItems.nth(pacedTrainIndex);
      await expect(pacedTrain).toBeVisible();

      await pacedTrainSection.expandPacedTrainOccurrenceList(pacedTrainIndex);

      const occurrences = ScenarioTimetableSection.getOccurrences(pacedTrain); // retrieves all occurrence for this mission

      const count = await occurrences.count();
      for (let occurrenceIndex = 0; occurrenceIndex < count; occurrenceIndex += 1) {
        const occurrenceButton = occurrences.nth(occurrenceIndex);
        await occurrenceButton.click();
        await this.verifySimulationResultsVisibility();
      }

      await pacedTrainSection.collapsePacedTrainOccurrenceList(pacedTrainIndex);
    }
  }

  // Iterate over each unique train and verify the visibility of simulation results
  async verifyEachUniqueTrainSimulation(uniqueTrainCount: number): Promise<void> {
    await expect(this.timetableItems.first()).toBeVisible();
    const timetableItemsCount = await this.timetableItems.count();
    for (
      let currentUniqueTrainIndex = uniqueTrainCount;
      currentUniqueTrainIndex < timetableItemsCount;
      currentUniqueTrainIndex += 1
    ) {
      await this.projectTrain(currentUniqueTrainIndex);
      await this.verifySimulationResultsVisibility();
    }
  }

  async editTimetableItem(index = 0) {
    await expect(this.timetableItems.nth(index)).toBeVisible();
    await this.timetableItems.nth(index).click();
    await this.editItemButton.nth(index).click();
  }

  async deleteTimetableItem(index = 0) {
    await expect(this.timetableItems.nth(index)).toBeVisible();
    await this.timetableItems.nth(index).click();
    await this.deleteItemButton.nth(index).click();
  }

  async projectTrain(index = 0) {
    const UniqueTrainButton = ScenarioTimetableSection.getUniqueTrainButton(
      this.timetableItems.nth(index)
    );
    await expect(UniqueTrainButton).toBeVisible();
    // Click and hover near the left edge to avoid action buttons
    await UniqueTrainButton.click({ position: { x: 5, y: 5 } });
    await UniqueTrainButton.scrollIntoViewIfNeeded();
    await UniqueTrainButton.hover({ position: { x: 5, y: 5 } });
    await expect(this.projectItemButton.nth(index)).toBeVisible();
    await this.projectItemButton.nth(index).click();
  }

  async getTimetableItemArrivalTime(expectedArrivalTime: string, index = 0) {
    await expect(this.timetableItemArrivalTime.nth(index)).toBeVisible();
    await expect(this.timetableItemArrivalTimeLoader).toBeHidden();
    await expect
      .poll(async () => await this.timetableItemArrivalTime.nth(index).innerText(), {
        timeout: 30_000,
      })
      .toBe(expectedArrivalTime);
  }

  async selectAllTimetableItems() {
    await this.timetableSelectAllButton.click();
    await expect(this.exportTimetableItemButton).toBeVisible();
    await expect(this.unselectTTimetableItemsButton).toBeVisible();
    await expect(this.deleteAllTimetableItemsButton).toBeVisible();
  }

  async selectAllTimetableItemsAndVerifySelection(
    translations: TimetableFilterTranslations & CommonTranslations,
    trainCounts: {
      totalPacedTrainCount: number;
      totalUniqueTrainCount: number;
    }
  ) {
    await this.timetableSelectOptionsButton.click();
    await expect(this.timetableSelectAllButton).toBeVisible();
    await this.selectAllTimetableItems();

    const { totalPacedTrainCount, totalUniqueTrainCount } = trainCounts;
    await expect(this.timetableTotalItemLabel).toBeVisible();

    // Rebuild the expected text for total items label which has the syntax : "X/X services and Y/Y trains selected"
    const trainTypeTranslation = translations.timetable.trainType; // format "Services, trains"
    const [pacedTrains, uniqueTrains] = trainTypeTranslation.split(', '); // expect to return ["Services", "trains"]
    const pacedTrainAndTrainCountTrad = translations.pacedTrainAndTrainCount; // finished by "selected"
    const selectedTrad = pacedTrainAndTrainCountTrad.split(' ').at(-1); // expect to return "selected"
    const expectedComputedLabel = `${totalPacedTrainCount}/${totalPacedTrainCount} ${pacedTrains.toLowerCase()}, ${totalUniqueTrainCount}/${totalUniqueTrainCount} ${uniqueTrains} ${selectedTrad}`;
    await expect(this.timetableTotalItemLabel).toHaveText(expectedComputedLabel);
  }

  async deleteAllTimetableItems() {
    await expect(this.deleteAllTimetableItemsButton).toBeVisible();
    await this.deleteAllTimetableItemsButton.click();

    await expect(this.confirmationModalDeleteButton).toBeVisible();
    await this.confirmationModalDeleteButton.click();
  }

  async verifyAllTimetableItemsHaveBeenDeleted(
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
    await expect(this.timetableItems).toHaveCount(0);
    await expect(this.timetableTotalItemLabel).toHaveText(translation);
  }

  async verifyEditTrainScheduleButtonVisibility() {
    await expect(this.editTrainScheduleButton).toBeVisible();
  }

  async verifyFirstTimetableItemIsSelected() {
    const timetableItem = this.timetableItems.first();
    await expect(timetableItem).toBeVisible();
    await expect(timetableItem).toHaveClass(/selected/);
  }

  async verifyInvalidReasons(expectedReason: string[]): Promise<void> {
    await expect(this.invalidTimetableItemsReasons.first()).toBeVisible();
    await expect(this.invalidTimetableItemsReasons).toHaveText(expectedReason);
  }

  async verifyTrainColor(expectedColor: string, index = 0) {
    await expect(this.trainName.nth(index)).toBeVisible();
    await expect(this.trainName.nth(index)).toHaveCSS('color', expectedColor);
  }
}

export default ScenarioTimetableSection;
