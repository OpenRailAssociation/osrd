import { type Locator, type Page, expect } from '@playwright/test';

import type {
  OccurrenceDetails,
  PacedTrainDetails,
  TimetableFilterTranslations,
} from '../../utils/types';
import CommonPage from '../common-page';

class PacedTrainSection extends CommonPage {
  private readonly pacedTrainItem: Locator;

  private readonly testedPacedTrain: Locator;

  private readonly testedPacedTrainToggleIcon: Locator;

  private readonly testedPacedTrainShowOccurrencesButton: Locator;

  private readonly testedPacedTrainName: Locator;

  private readonly testedPacedTrainRollingStock: Locator;

  private readonly testedPacedTrainCadence: Locator;

  private readonly testedPacedTrainOccurrences: Locator;

  private readonly testedOccurrenceName: Locator;

  private readonly testedOccurrenceStartTime: Locator;

  private readonly testedOccurrenceArrivalTime: Locator;

  readonly timesStopsDataSheet: Locator;

  private readonly occurrencesCount: Locator;

  private readonly manageTrainSchedulePage: Locator;

  constructor(page: Page) {
    super(page);
    this.pacedTrainItem = page.getByTestId('paced-train');
    this.testedPacedTrain = page.locator('.paced-train:not(.closed)');
    this.testedPacedTrainToggleIcon = this.testedPacedTrain.locator('.toggle-icon');
    this.testedPacedTrainShowOccurrencesButton =
      this.testedPacedTrain.getByTestId('show-occurrences-button');
    this.testedPacedTrainName = this.testedPacedTrain.getByTestId('paced-train-name');
    this.testedPacedTrainRollingStock = this.testedPacedTrain.locator('> .rolling-stock');
    this.testedPacedTrainCadence = this.testedPacedTrain.getByTestId('paced-train-cadence');
    this.testedPacedTrainOccurrences = this.testedPacedTrain.getByTestId('occurrence-item');
    this.testedOccurrenceName = this.testedPacedTrain.locator('.occurrence-item-name');
    this.testedOccurrenceStartTime = this.testedPacedTrain.locator('.departure-time');
    this.testedOccurrenceArrivalTime = this.testedPacedTrain.locator('.arrival-time');
    this.timesStopsDataSheet = page.locator('.time-stops-datasheet');
    this.occurrencesCount = page.getByTestId('occurrences-count');
    this.manageTrainSchedulePage = page.getByTestId('manage-train-schedule');
  }

  // Only the zone with the role button opens the occurrence list
  async getPacedTrainToClickableZone(index: number) {
    return this.pacedTrainItem.nth(index).getByTestId('paced-train-main-info');
  }

  async verifyPacedTrainItemDetails(
    pacedTrainData: PacedTrainDetails,
    index: number,
    {
      copyTranslation,
      occurrenceData,
      pacedTrainCardAlreadyOpen,
    }: {
      copyTranslation?: string;
      occurrenceData?: OccurrenceDetails[];
      pacedTrainCardAlreadyOpen?: boolean;
    } = {}
  ) {
    const { name, labels, duration: pacedTrainDuration, step } = pacedTrainData;

    const pacedTrainItemClickableZone = await this.getPacedTrainToClickableZone(index);

    // In paced_trains.json, invalid paced trains are marked with an `Invalid` label
    // An invalid paced train won't have any details
    if (labels?.includes('Invalid')) return;

    const totalOccurrences = Math.ceil(+pacedTrainDuration / +step);
    await this.verifyOccurrencesCount(totalOccurrences, index);

    // Open the occurrences list to be able to have a unique
    // paced train locator for the tested one
    await expect(pacedTrainItemClickableZone).toBeVisible();
    if (!pacedTrainCardAlreadyOpen) await pacedTrainItemClickableZone.click();

    await expect(this.testedPacedTrainShowOccurrencesButton).not.toBeVisible();
    await expect(this.testedPacedTrainOccurrences.first()).toBeVisible();
    await expect(this.testedPacedTrainOccurrences).toHaveCount(totalOccurrences);

    let expectedName = name;
    if (copyTranslation) {
      // duplicated train name should have format : "name (copy)"
      expectedName = `${name} (${copyTranslation})`;
    }
    await expect(this.testedPacedTrainName).toBeVisible();
    await expect(this.testedPacedTrainName).toHaveText(expectedName);

    await expect(this.testedPacedTrainCadence).toBeVisible();
    await expect(this.testedPacedTrainCadence).toHaveText(
      `${String.fromCodePoint(0x2014)} ${step}min`
    ); // UI format: "- Xmin"

    // Verify that the pace train item does not display the rolling stock
    await expect(this.testedPacedTrainRollingStock).not.toBeVisible();

    await this.verifyItemsVisibility(index, 'paced-train');

    if (occurrenceData) {
      for (let occurrenceIndex = 0; occurrenceIndex < totalOccurrences; occurrenceIndex += 1) {
        await this.verifyOccurrenceDetails(occurrenceData[occurrenceIndex], occurrenceIndex, {
          copyTranslation,
        });
      }
    }

    // Close back the occurrences list
    await this.testedPacedTrainToggleIcon.click();
  }

  async verifyOccurrencesCount(expectedOccurrencesCount: number, index: number) {
    const pacedTrainOccurrencesCount = this.occurrencesCount.nth(index);
    await expect(pacedTrainOccurrencesCount).toBeVisible();
    const occurrencesCount = await pacedTrainOccurrencesCount.textContent();
    expect(+occurrencesCount!).toEqual(expectedOccurrencesCount);
  }

  async verifyOccurrenceName(
    occurrenceIndex: number,
    expectedName: string,
    duplicate?: { copyTranslation?: string }
  ) {
    const occurrenceNameLocator = this.testedOccurrenceName.nth(occurrenceIndex);
    if (duplicate?.copyTranslation) {
      // duplicated train name should have format : "name (copy) and start with suffix 1 then 3, 5..."
      expectedName = `${expectedName} (${duplicate.copyTranslation}) ${occurrenceIndex * 2 + 1}`;
    }
    await expect(occurrenceNameLocator).toHaveText(expectedName);
  }

  async verifyOccurrenceStartTime(occurrenceIndex: number, expectedStartTime: string) {
    const occurrenceStartTimeLocator = this.testedOccurrenceStartTime.nth(occurrenceIndex);
    await expect(occurrenceStartTimeLocator).toHaveText(expectedStartTime);
  }

  async verifyOccurrenceArrivalTime(occurrenceIndex: number, expectedArrivalTime: string) {
    const occurrenceArrivalTimeLocator = this.testedOccurrenceArrivalTime.nth(occurrenceIndex);
    await expect(occurrenceArrivalTimeLocator).toHaveText(expectedArrivalTime);
  }

  async getActionButtonsLocators(
    itemIndex: number,
    itemType: 'paced-train' | 'occurrence'
  ): Promise<Record<string, Locator>> {
    const timetableItem =
      itemType === 'paced-train'
        ? this.testedPacedTrain
        : this.testedPacedTrainOccurrences.nth(itemIndex);

    if (itemType === 'paced-train') {
      await this.pacedTrainItem.nth(itemIndex).hover({ force: true });
    } else {
      await timetableItem.hover({ force: true });
    }
    return {
      projectItem: timetableItem.getByTestId('project-item'),
      duplicateItem: timetableItem.getByTestId('duplicate-item'),
      editItem: timetableItem.getByTestId('edit-item'),
      deleteItem: timetableItem.getByTestId('delete-item'),
    };
  }

  async verifyItemsVisibility(
    itemIndex: number,
    itemType: 'paced-train' | 'occurrence'
  ): Promise<void> {
    const actionButtonsLocators = this.getActionButtonsLocators(itemIndex, itemType);

    // Actions buttons should be visible when hovering a paced train but not for an occurrence
    await Promise.all(
      Object.values(actionButtonsLocators).map((locator) =>
        itemType === 'paced-train'
          ? expect(locator).toBeVisible()
          : expect(locator).not.toBeVisible()
      )
    );
  }

  async verifyOccurrenceDetails(
    occurrenceData: OccurrenceDetails,
    occurrenceIndex: number,
    duplicate?: {
      copyTranslation?: string;
    }
  ) {
    const occurrenceItem = this.testedPacedTrainOccurrences.nth(occurrenceIndex);

    await this.verifyOccurrenceName(occurrenceIndex, occurrenceData.name, {
      copyTranslation: duplicate?.copyTranslation,
    });

    await this.verifyOccurrenceStartTime(occurrenceIndex, occurrenceData.startTime);
    await this.verifyOccurrenceArrivalTime(occurrenceIndex, occurrenceData.arrivalTime);

    await expect(occurrenceItem.locator('.rolling-stock img')).toBeVisible();

    await this.verifyItemsVisibility(occurrenceIndex, 'occurrence');
  }

  async clickOnOccurrence({
    pacedTrainIndex,
    occurrenceIndex,
  }: {
    pacedTrainIndex: number;
    occurrenceIndex: number;
  }) {
    const pacedTrainItemClickableZone = await this.getPacedTrainToClickableZone(pacedTrainIndex);

    // Open the occurrences list to be able to have a unique
    // paced train locator for the tested one
    await expect(pacedTrainItemClickableZone).toBeVisible();
    await pacedTrainItemClickableZone.click();

    const occurrenceItem = this.testedPacedTrainOccurrences.nth(occurrenceIndex);
    await occurrenceItem.click();

    await pacedTrainItemClickableZone.click();
  }

  async duplicatePacedTrain() {
    const pacedTrainItem = await this.getPacedTrainToClickableZone(0);
    await pacedTrainItem.click();
    const actionButtons = await this.getActionButtonsLocators(0, 'paced-train');
    await actionButtons.duplicateItem.click();

    await pacedTrainItem.click();
  }

  async editPacedTrain(index: number = 0) {
    const pacedTrainItem = await this.getPacedTrainToClickableZone(index);
    await pacedTrainItem.click();
    const actionButtons = await this.getActionButtonsLocators(index, 'paced-train');
    await actionButtons.editItem.click();
    await expect(this.manageTrainSchedulePage).toBeVisible();
  }

  async deletePacedTrain(
    pacedTrainData: PacedTrainDetails,
    index: number,
    translations: TimetableFilterTranslations
  ) {
    const { name } = pacedTrainData;

    const timetableItemToDelete = await this.getPacedTrainToClickableZone(index);
    await timetableItemToDelete.click();

    const duplicatedPacedTrainActionButtons = await this.getActionButtonsLocators(
      index,
      'paced-train'
    );
    await duplicatedPacedTrainActionButtons.deleteItem.click();

    await this.verifyPacedTrainHasBeenDeleted(name, translations);

    await expect(timetableItemToDelete).not.toHaveText(name); // the item at this index should not be the same
  }

  async verifyPacedTrainHasBeenDeleted(
    deletedPacedTrainName: string,
    translations: TimetableFilterTranslations
  ) {
    const duplicatedPacedTrainName = `${deletedPacedTrainName} (${translations.timetable.copy})`;
    // Translation has format 'The service {{name}} has been deleted';
    const [firstPart, secondPart] = translations.timetable.pacedTrainDeleted.split('{{name}}');
    const expectedDeleteToast = `${firstPart}${duplicatedPacedTrainName}${secondPart}`;
    await this.checkToastTitle(expectedDeleteToast);
    await this.closeToastNotification();
  }
}

export default PacedTrainSection;
