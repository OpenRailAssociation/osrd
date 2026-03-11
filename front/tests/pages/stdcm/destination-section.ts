import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import {
  CI_SUGGESTIONS,
  DESTINATION_DETAILS,
  LIGHT_DESTINATION_DETAILS,
  STDCM_TRANSLATIONS,
} from '../../assets/constants/stdcm/stdcm-const';

class DestinationSection extends STDCMPage {
  readonly destinationCiField: Locator;
  readonly destinationChField: Locator;
  readonly destinationArrival: Locator;
  readonly dateDestinationArrival: Locator;
  readonly timeDestinationArrival: Locator;
  readonly toleranceDestinationArrival: Locator;
  private readonly suggestionSS: Locator;
  private readonly closeDestinationTimePickerButton: Locator;
  private readonly clearButton: Locator;
  private readonly destinationIncrementTimeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.destinationCiField = this.destinationCard.getByTestId('operational-point-ci');
    this.destinationChField = this.destinationCard.getByTestId('operational-point-ch');
    this.destinationArrival = page.locator('#select-destination-arrival');
    this.dateDestinationArrival = page.getByTestId('date-destination-arrival-input');
    this.timeDestinationArrival = page.getByTestId('time-destination-arrival-input');
    this.toleranceDestinationArrival = page.getByTestId('tolerance-destination-arrival-input');
    this.suggestionSS = this.suggestionItems.filter({ hasText: 'SS South_station' });
    this.clearButton = this.destinationCard.locator('.clear-icon');
    this.destinationIncrementTimeButton = page.getByTestId(
      'time-destination-arrival-increment-minute'
    );
    this.closeDestinationTimePickerButton = page.getByTestId(
      'time-destination-arrival-modal-close-button'
    );
  }

  private async setMinuteLocator(minuteValue: string) {
    await this.page.locator('.time-grid .minute', { hasText: minuteValue }).click();
  }

  private async setHourLocator(hourValue: string) {
    await this.page.locator('.time-grid .hour', { hasText: hourValue }).click();
  }

  async verifyDefaultDestinationFields() {
    const emptyFields = [this.destinationCiField, this.destinationChField];
    for (const field of emptyFields) await expect(field).toHaveValue('');
    await expect(this.destinationArrival).toHaveValue(DESTINATION_DETAILS.arrivalType.default);
  }

  // Verify the destination suggestions when searching for south
  private async verifyDestinationSouthSuggestions() {
    await this.verifySuggestions(CI_SUGGESTIONS.south);
  }

  async fillAndVerifyDestinationDetails() {
    const {
      input,
      suggestion,
      chValue,
      arrivalDate,
      arrivalTime,
      tolerance,
      arrivalType,
      updatedDetails,
    } = DESTINATION_DETAILS;

    await this.destinationCiField.fill(input);
    await this.verifyDestinationSouthSuggestions();
    await this.suggestionSS.click();
    const destinationCiValue = await this.destinationCiField.getAttribute('value');
    expect(destinationCiValue).toContain(suggestion);
    await expect(this.destinationChField).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType.default);
    await this.launchSimulationButton.click();
    await expect(this.warningBox).toContainText(
      STDCM_TRANSLATIONS.stdcmErrors.routeErrors.noScheduledPoint
    );
    await expect(this.dateDestinationArrival).not.toBeVisible();
    await expect(this.timeDestinationArrival).not.toBeVisible();
    await expect(this.toleranceDestinationArrival).not.toBeVisible();
    await this.destinationArrival.selectOption(arrivalType.updated);
    await expect(this.destinationArrival).toHaveValue(arrivalType.updated);
    await expect(this.dateDestinationArrival).toHaveValue(arrivalDate);
    await expect(this.timeDestinationArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceDestinationArrival).toHaveValue(tolerance);
    await this.dateDestinationArrival.fill(updatedDetails.date);
    await expect(this.dateDestinationArrival).toHaveValue(updatedDetails.date);
    await this.timeDestinationArrival.click();
    await this.setHourLocator(updatedDetails.hour);
    await this.setMinuteLocator(updatedDetails.minute);
    await this.destinationIncrementTimeButton.dblclick(); // Double-click the +1 minute button to reach 37
    await this.closeDestinationTimePickerButton.click();
    await expect(this.timeDestinationArrival).toHaveValue(updatedDetails.timeValue);
    await this.fillToleranceField({
      toleranceInput: this.toleranceDestinationArrival,
      minusValue: updatedDetails.tolerance.negative,
      plusValue: updatedDetails.tolerance.positive,
      toleranceOp: 'destination',
    });
    await expect(this.warningBox).not.toBeVisible();
  }

  async fillDestinationDetailsLight() {
    const { input, chValue, arrivalType } = LIGHT_DESTINATION_DETAILS;
    await this.destinationCiField.fill(input);
    await this.suggestionSS.click();
    await expect(this.destinationChField).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType);
  }

  async verifyDestinationDetails() {
    const { chValue, arrivalType } = DESTINATION_DETAILS;
    await expect(this.destinationCiField).toHaveValue(CI_SUGGESTIONS.south[1]);
    await expect(this.destinationChField).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType.default);
  }

  async clearDestination(): Promise<void> {
    await this.clearButton.click();
    await expect(this.destinationCiField).toHaveValue('');
  }
}

export default DestinationSection;
