import { type Locator, type Page, expect } from '@playwright/test';

import ScenarioTimetableSection from './scenario-timetable-section';

export type DetailRow = {
  stopsCount: string;
  pathLength: string;
  energyConsumed: string;
  durationTime: string;
};

class TrainScheduleDetailSection extends ScenarioTimetableSection {
  private readonly showTrainsDetailsButton: Locator;
  private readonly pacedTrainDetailLabels: Locator;
  private readonly uniqueTrainDetailLabels: Locator;
  private readonly pacedTrainStopsCount: Locator;
  private readonly pacedTrainPathLength: Locator;
  private readonly pacedTrainEnergyConsumed: Locator;
  private readonly pacedTrainDurationTime: Locator;
  private readonly uniqueTrainStopsCount: Locator;
  private readonly uniqueTrainPathLength: Locator;
  private readonly uniqueTrainEnergyConsumed: Locator;
  private readonly uniqueTrainDurationTime: Locator;

  constructor(page: Page) {
    super(page);
    this.showTrainsDetailsButton = page.getByTestId('scenarios-show-train-details-button');
    this.pacedTrainDetailLabels = page.getByTestId('paced-train-more-info');
    this.uniqueTrainDetailLabels = page.getByTestId('unique-train-more-info');
    this.pacedTrainStopsCount = page.getByTestId('paced-train-stop-count');
    this.pacedTrainPathLength = page.getByTestId('paced-train-path-length');
    this.pacedTrainEnergyConsumed = page.getByTestId('paced-train-allowance-energy-consumed');
    this.pacedTrainDurationTime = page.getByTestId('paced-train-duration-time');
    this.uniqueTrainStopsCount = page.getByTestId('unique-train-stop-count');
    this.uniqueTrainPathLength = page.getByTestId('unique-train-path-length');
    this.uniqueTrainEnergyConsumed = page.getByTestId('unique-train-allowance-energy-consumed');
    this.uniqueTrainDurationTime = page.getByTestId('unique-train-duration-time');
  }

  async showTrainSchedulesDetails(): Promise<void> {
    await this.showTrainsDetailsButton.click();
    await expect(this.pacedTrainDetailLabels.first()).toBeVisible();
    await expect(this.uniqueTrainDetailLabels.first()).toBeVisible();
  }

  async verifyPacedTrainDetails(
    pacedTrainIndex: number,
    expectedDetails: DetailRow
  ): Promise<void> {
    const { stopsCount, pathLength, energyConsumed, durationTime } = expectedDetails;

    await expect.soft(this.pacedTrainStopsCount.nth(pacedTrainIndex)).toHaveText(stopsCount);
    await expect.soft(this.pacedTrainPathLength.nth(pacedTrainIndex)).toHaveText(pathLength);
    await expect
      .soft(this.pacedTrainEnergyConsumed.nth(pacedTrainIndex))
      .toHaveText(energyConsumed);
    await expect.soft(this.pacedTrainDurationTime.nth(pacedTrainIndex)).toHaveText(durationTime);
  }

  async verifyUniqueTrainDetails(
    uniqueTrainIndex: number,
    expectedDetails: DetailRow
  ): Promise<void> {
    const { stopsCount, pathLength, energyConsumed, durationTime } = expectedDetails;

    await expect.soft(this.uniqueTrainStopsCount.nth(uniqueTrainIndex)).toHaveText(stopsCount);
    await expect.soft(this.uniqueTrainPathLength.nth(uniqueTrainIndex)).toHaveText(pathLength);
    await expect
      .soft(this.uniqueTrainEnergyConsumed.nth(uniqueTrainIndex))
      .toHaveText(energyConsumed);
    await expect.soft(this.uniqueTrainDurationTime.nth(uniqueTrainIndex)).toHaveText(durationTime);
  }

  async verifyUniqueTrainsDetails(details: DetailRow[]): Promise<void> {
    for (
      let validUniqueTrainIndex = 0;
      validUniqueTrainIndex < details.length;
      validUniqueTrainIndex += 1
    ) {
      await this.verifyUniqueTrainDetails(validUniqueTrainIndex, details[validUniqueTrainIndex]);
    }
  }
}

export default TrainScheduleDetailSection;
