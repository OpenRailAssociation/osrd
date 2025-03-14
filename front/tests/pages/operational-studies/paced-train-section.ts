import { type Locator, type Page, expect } from '@playwright/test';

import { DUPLICATED_PACED_TRAIN_DELTA } from '../../assets/constants/timetable-items-count';
import type { OccurrenceDetails, PacedTrainDetails } from '../../utils/types';
import CommonPage from '../common-page';

class PacedTrainSection extends CommonPage {
  private readonly timetableTrains: Locator;

  readonly timesStopsDataSheet: Locator;

  private readonly occurrencesCount: Locator;

  private readonly hideOccurrencesButton: Locator;

  private readonly occurrenceItem: Locator;

  constructor(page: Page) {
    super(page);
    this.timetableTrains = page.getByTestId('scenario-timetable-train');
    this.timesStopsDataSheet = page.locator('.time-stops-datasheet');
    this.occurrencesCount = page.getByTestId('occurrences-count');
    this.hideOccurrencesButton = page.getByTestId('hide-occurrences-button');
    this.occurrenceItem = page.getByTestId('occurrence-item');
  }

  async verifyPacedTrainItemDetails(
    pacedTrainData: PacedTrainDetails,
    index: number,
    occurrenceData: OccurrenceDetails[]
  ) {
    const { name, labels, duration: pacedTrainDuration, step } = pacedTrainData;

    const pacedTrainItem = this.timetableTrains.nth(index);

    // In paced_trains.json, invalid paced trains are marked with an `Invalid` label
    // An invalid paced train won't have any details
    if (labels?.includes('Invalid')) return;

    const totalOccurrences = Math.ceil(+pacedTrainDuration / +step);
    await this.verifyOccurrencesCount(totalOccurrences, index);

    await expect(this.hideOccurrencesButton.nth(index)).not.toBeVisible();
    await expect(pacedTrainItem.locator('.toggle-icon')).toBeVisible();
    await expect(this.occurrenceItem.first()).not.toBeVisible();

    const pacedTrainNameLocator = pacedTrainItem.getByTestId('paced-train-name');
    await expect(pacedTrainNameLocator).toBeVisible();
    await expect(pacedTrainNameLocator).toHaveText(name);

    const pacedTrainCadenceLocator = pacedTrainItem.getByTestId('paced-train-cadence');
    await expect(pacedTrainCadenceLocator).toBeVisible();
    await expect(pacedTrainCadenceLocator).toHaveText(`${String.fromCodePoint(0x2014)} ${step}min`); // UI format: "- Xmin"

    // Verify that the pace train item does not display the rolling stock
    await expect(pacedTrainItem.locator('> .rolling-stock')).not.toBeVisible();

    // Verify all action buttons are displayed when hovering the paced train item
    await pacedTrainItem.hover();
    await expect(pacedTrainItem.getByTestId('project-item')).toBeVisible();
    await expect(pacedTrainItem.getByTestId('duplicate-item')).toBeVisible();
    await expect(pacedTrainItem.getByTestId('edit-item')).toBeVisible();
    await expect(pacedTrainItem.getByTestId('delete-item')).toBeVisible();

    await pacedTrainItem.locator('.toggle-icon').click();
    await expect(pacedTrainItem.getByTestId('occurrence-item')).toHaveCount(totalOccurrences);

    for (let i = 0; i < totalOccurrences; i += 1) {
      await this.verifyOccurrenceDetails(occurrenceData[i], i, index);
    }

    // Close back the occurrences list
    await pacedTrainItem.locator('.toggle-icon').click();
  }

  async verifyOccurrencesCount(expectedOccurrencesCount: number, index: number) {
    const pacedTrainOccurrencesCount = this.occurrencesCount.nth(index);
    await expect(pacedTrainOccurrencesCount).toBeVisible();
    const occurrencesCount = await pacedTrainOccurrencesCount.textContent();
    expect(+occurrencesCount!).toEqual(expectedOccurrencesCount);
  }

  getOccurrenceItem(occurrenceIndex: number): Locator {
    return this.page.getByTestId('occurrence-item').nth(occurrenceIndex);
  }

  async verifyOccurrenceName(occurrenceIndex: number, expectedName: string) {
    const occurrenceNameLocator =
      this.getOccurrenceItem(occurrenceIndex).locator('.occurrence-item-name');
    await expect(occurrenceNameLocator).toHaveText(expectedName);
  }

  async verifyOccurrenceStartTime(occurrenceIndex: number, expectedStartTime: string) {
    const occurrenceStartTimeLocator =
      this.getOccurrenceItem(occurrenceIndex).locator('.departure-time');
    await expect(occurrenceStartTimeLocator).toHaveText(expectedStartTime);
  }

  async verifyOccurrenceArrivalTime(occurrenceIndex: number, expectedArrivalTime: string) {
    const occurrenceArrivalTimeLocator =
      this.getOccurrenceItem(occurrenceIndex).locator('.arrival-time');
    await expect(occurrenceArrivalTimeLocator).toHaveText(expectedArrivalTime);
  }

  async getActionButtonsLocators(occurrenceIndex: number): Promise<Record<string, Locator>> {
    const occurrenceItem = this.getOccurrenceItem(occurrenceIndex);
    await occurrenceItem.hover();
    return {
      projectItem: occurrenceItem.getByTestId('project-item'),
      duplicateItem: occurrenceItem.getByTestId('duplicate-item'),
      editItem: occurrenceItem.getByTestId('edit-item'),
      deleteItem: occurrenceItem.getByTestId('delete-item'),
    };
  }

  async verifyItemsNotVisible(occurrenceIndex: number): Promise<void> {
    const actionButtonsLocators = this.getActionButtonsLocators(occurrenceIndex);
    await Promise.all(
      Object.values(actionButtonsLocators).map((locator) => expect(locator).not.toBeVisible())
    );
  }

  async verifyOccurrenceDetails(
    occurrenceData: OccurrenceDetails,
    occurrenceIndex: number,
    pacedTrainIndex: number
  ) {
    const pacedTrainItem = this.timetableTrains.nth(pacedTrainIndex);
    const occurrenceItem = pacedTrainItem.getByTestId('occurrence-item').nth(occurrenceIndex);

    await this.verifyOccurrenceName(occurrenceIndex, occurrenceData.name);

    await this.verifyOccurrenceStartTime(occurrenceIndex, occurrenceData.startTime);
    await this.verifyOccurrenceArrivalTime(occurrenceIndex, occurrenceData.arrivalTime);

    await expect(occurrenceItem.locator('.rolling-stock img')).toBeVisible();

    await this.verifyItemsNotVisible(occurrenceIndex);
  }

  async duplicatePacedTrain() {
    const pacedTrainItem = this.timetableTrains.first();
    await pacedTrainItem.hover();
    await pacedTrainItem.getByTestId('duplicate-item').click();

    await this.closeToastNotification();
  }

  // Duplicate the first paced train of the list
  async verifyDuplicatedPacedTrain(
    originPacedTrainData: Pick<PacedTrainDetails, 'name' | 'startTime'>,
    copyTranslation: string
  ) {
    const {
      name,
      startTime,
      // paced: { duration: pacedTrainDuration, step },
    } = originPacedTrainData;

    const duplicatedPacedTrainItem = this.timetableTrains.nth(1);

    const pacedTrainNameLocator = duplicatedPacedTrainItem.getByTestId('paced-train-name');
    await expect(pacedTrainNameLocator).toBeVisible();
    // duplicated train name should have format : "name (copy)"
    await expect(pacedTrainNameLocator).toHaveText(`${name} (${copyTranslation})`);

    await duplicatedPacedTrainItem.locator('.toggle-icon').click();
    const firstOccurrenceItem = duplicatedPacedTrainItem.getByTestId('occurrence-item').first();

    const [hours, minutes] = startTime.split(':');
    // duplicated start time should increase by 5 minutes
    const duplicatedStartTime = `${hours}:${+minutes + DUPLICATED_PACED_TRAIN_DELTA}`;
    await expect(firstOccurrenceItem.locator('.departure-time')).toHaveText(duplicatedStartTime);

    // const formattedDuration = dayjs.duration(pacedTrainDuration).asMinutes();
    // const formattedStep = dayjs.duration(step).asMinutes();
    // const totalOccurrences = Math.ceil(formattedDuration / formattedStep);
    // await this.verifyOccurrencesCount(totalOccurrences, index);
  }
}

export default PacedTrainSection;
