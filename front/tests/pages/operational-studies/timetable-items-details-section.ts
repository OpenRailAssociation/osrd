import { type Locator, type Page, expect } from '@playwright/test';

import ScenarioTimetableSection from './scenario-timetable-section';

export type DetailRow = {
  stopsCount: string;
  pathLength: string;
  energyConsumed: string;
  durationTime: string;
};

class TimetableItemDetailSection extends ScenarioTimetableSection {
  private readonly showItemsDetailsButton: Locator;
  private readonly pacedTrainDetailLabels: Locator;
  private readonly trainScheduleDetailLabels: Locator;

  private readonly pacedTrainStopsCount: Locator;
  private readonly pacedTrainPathLength: Locator;
  private readonly pacedTrainEnergyConsumed: Locator;
  private readonly pacedTrainDurationTime: Locator;

  private readonly trainScheduleStopsCount: Locator;
  private readonly trainSchedulePathLength: Locator;
  private readonly trainScheduleEnergyConsumed: Locator;
  private readonly trainScheduleDurationTime: Locator;

  constructor(page: Page) {
    super(page);
    this.showItemsDetailsButton = page.getByTestId('scenarios-show-train-details-button');

    this.pacedTrainDetailLabels = page.getByTestId('paced-train-more-info');
    this.trainScheduleDetailLabels = page.getByTestId('train-schedule-more-info');

    this.pacedTrainStopsCount = page.getByTestId('paced-train-stop-count');
    this.pacedTrainPathLength = page.getByTestId('paced-train-path-length');
    this.pacedTrainEnergyConsumed = page.getByTestId('paced-train-allowance-energy-consumed');
    this.pacedTrainDurationTime = page.getByTestId('paced-train-duration-time');

    this.trainScheduleStopsCount = page.getByTestId('train-schedule-stop-count');
    this.trainSchedulePathLength = page.getByTestId('train-schedule-path-length');
    this.trainScheduleEnergyConsumed = page.getByTestId('train-schedule-allowance-energy-consumed');
    this.trainScheduleDurationTime = page.getByTestId('train-schedule-duration-time');
  }

  async showTimetableItemsDetails(): Promise<void> {
    await this.timetableBoardWrapperMenuButton.click();
    await this.showItemsDetailsButton.click();
    await expect(this.pacedTrainDetailLabels.first()).toBeVisible();
    await expect(this.trainScheduleDetailLabels.first()).toBeVisible();
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

  async verifyTrainScheduleDetails(
    trainScheduleIndex: number,
    expectedDetails: DetailRow
  ): Promise<void> {
    const { stopsCount, pathLength, energyConsumed, durationTime } = expectedDetails;

    await expect.soft(this.trainScheduleStopsCount.nth(trainScheduleIndex)).toHaveText(stopsCount);
    await expect.soft(this.trainSchedulePathLength.nth(trainScheduleIndex)).toHaveText(pathLength);
    await expect
      .soft(this.trainScheduleEnergyConsumed.nth(trainScheduleIndex))
      .toHaveText(energyConsumed);
    await expect
      .soft(this.trainScheduleDurationTime.nth(trainScheduleIndex))
      .toHaveText(durationTime);
  }

  async verifyTrainSchedulesDetails(details: DetailRow[]): Promise<void> {
    for (
      let validTrainScheduleIndex = 0;
      validTrainScheduleIndex < details.length;
      validTrainScheduleIndex += 1
    ) {
      await this.verifyTrainScheduleDetails(
        validTrainScheduleIndex,
        details[validTrainScheduleIndex]
      );
    }
  }
}

export default TimetableItemDetailSection;
