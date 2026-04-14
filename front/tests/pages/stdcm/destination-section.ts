import { expect, type Locator, type Page } from '@playwright/test';

import { expectFieldsToHaveValues } from '../../utils';
import type { DestinationDetailsData, LightDestinationDetailsData } from '../../utils/stdcm-types';
import STDCMPage from './stdcm-page';

class DestinationSection extends STDCMPage {
  readonly destinationCiField: Locator;
  readonly destinationChField: Locator;
  readonly destinationArrival: Locator;
  readonly dateDestinationArrival: Locator;
  readonly timeDestinationArrival: Locator;
  readonly toleranceDestinationArrival: Locator;
  private readonly closeDestinationTimePickerButton: Locator;
  private readonly clearButton: Locator;
  private readonly destinationIncrementTimeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.destinationCiField = this.destinationCard.getByTestId('operational-point-ci');
    this.destinationChField = this.destinationCard.getByTestId('operational-point-ch');
    this.destinationArrival = page.getByTestId('select-destination-arrival');
    this.dateDestinationArrival = page.getByTestId('date-destination-arrival-input');
    this.timeDestinationArrival = page.getByTestId('time-destination-arrival-input');
    this.toleranceDestinationArrival = page.getByTestId('tolerance-destination-arrival-input');
    this.clearButton = this.destinationCard.locator('.clear-icon');
    this.destinationIncrementTimeButton = page.getByTestId(
      'time-destination-arrival-increment-minute'
    );
    this.closeDestinationTimePickerButton = page.getByTestId(
      'time-destination-arrival-modal-close-button'
    );
  }

  private getSuggestionByText(text: string): Locator {
    return this.suggestionItems.filter({ hasText: text });
  }

  private async selectHour(hourValue: string): Promise<void> {
    await this.page.getByTestId('time-grid').getByTestId(`hour-${hourValue}`).click();
  }

  private async selectMinute(minuteValue: string): Promise<void> {
    await this.page.getByTestId('time-grid').getByTestId(`minute-${minuteValue}`).click();
  }

  private async selectDestination({
    input,
    expectedCiValue,
    expectedSuggestions,
  }: {
    input: string;
    expectedCiValue: string;
    expectedSuggestions: string[];
  }): Promise<void> {
    await this.destinationCiField.fill(input);
    await this.verifySuggestions(expectedSuggestions);
    await this.getSuggestionByText(expectedCiValue).click();
    await expect(this.destinationCiField).toHaveValue(expectedCiValue);
  }

  private async expectNoScheduledPointWarning(expectedMessage: string): Promise<void> {
    await expect(this.warningBox).toContainText(expectedMessage);
  }

  private async expectArrivalFieldsToBeHidden(): Promise<void> {
    await Promise.all([
      expect(this.dateDestinationArrival).toBeHidden(),
      expect(this.timeDestinationArrival).toBeHidden(),
      expect(this.toleranceDestinationArrival).toBeHidden(),
    ]);
  }

  private async setDestinationTime(
    hourValue: string,
    minuteValue: string,
    incrementOneMinuteTwice = false
  ): Promise<void> {
    await this.timeDestinationArrival.click();
    await this.selectHour(hourValue);
    await this.selectMinute(minuteValue);

    if (incrementOneMinuteTwice) {
      await this.destinationIncrementTimeButton.dblclick();
    }

    await this.closeDestinationTimePickerButton.click();
  }

  async verifyDefaultDestinationFields(defaultArrivalType: string): Promise<void> {
    await expectFieldsToHaveValues([
      [this.destinationCiField, ''],
      [this.destinationChField, ''],
      [this.destinationArrival, defaultArrivalType],
    ]);
  }

  async fillAndVerifyDestinationDetails({
    destinationDetails,
    southSuggestions,
    noScheduledPointMessage,
  }: {
    destinationDetails: DestinationDetailsData;
    southSuggestions: string[];
    noScheduledPointMessage: string;
  }): Promise<void> {
    const {
      input,
      expectedCiValue,
      chValue,
      arrivalDate,
      arrivalTime,
      tolerance,
      arrivalType,
      updatedDetails,
    } = destinationDetails;

    await this.selectDestination({
      input,
      expectedCiValue,
      expectedSuggestions: southSuggestions,
    });

    await expect(this.destinationChField).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType.default);

    await this.launchSimulationButton.click();
    await this.expectNoScheduledPointWarning(noScheduledPointMessage);
    await this.expectArrivalFieldsToBeHidden();

    await this.destinationArrival.selectOption(arrivalType.updated);
    await expectFieldsToHaveValues([
      [this.dateDestinationArrival, arrivalDate],
      [this.timeDestinationArrival, arrivalTime],
      [this.toleranceDestinationArrival, tolerance],
      [this.destinationArrival, arrivalType.updated],
    ]);

    await this.dateDestinationArrival.fill(updatedDetails.date);
    await expect(this.dateDestinationArrival).toHaveValue(updatedDetails.date);

    await this.setDestinationTime(updatedDetails.hour, updatedDetails.minute, true);
    await expect(this.timeDestinationArrival).toHaveValue(updatedDetails.timeValue);

    await this.fillToleranceField({
      toleranceInput: this.toleranceDestinationArrival,
      minusValue: updatedDetails.tolerance.negative,
      plusValue: updatedDetails.tolerance.positive,
      toleranceOp: 'destination',
    });

    await expect(this.warningBox).not.toBeVisible();
  }

  async fillDestinationDetailsLight({
    destinationDetails,
    southSuggestions,
  }: {
    destinationDetails: LightDestinationDetailsData;
    southSuggestions: string[];
    suggestionText: string;
  }): Promise<void> {
    const { input, expectedCiValue, chValue, arrivalType } = destinationDetails;

    await this.selectDestination({
      input,
      expectedCiValue,
      expectedSuggestions: southSuggestions,
    });

    await expect(this.destinationChField).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType);
  }

  async verifyDestinationDetails({
    expectedCiValue,
    chValue,
    updatedArrivalType,
  }: {
    expectedCiValue: string;
    chValue: string;
    updatedArrivalType: string;
  }): Promise<void> {
    await expectFieldsToHaveValues([
      [this.destinationCiField, expectedCiValue],
      [this.destinationChField, chValue],
      [this.destinationArrival, updatedArrivalType],
    ]);
  }

  async clearDestination(): Promise<void> {
    await this.clearButton.click();
    await expect(this.destinationCiField).toHaveValue('');
  }
}

export default DestinationSection;
