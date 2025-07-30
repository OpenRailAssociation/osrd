import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import {
  CI_SUGGESTIONS,
  DESTINATION_DETAILS,
  LIGHT_DESTINATION_DETAILS,
} from '../../assets/constants/stdcm-const';
import readJsonFile from '../../utils/file-utils';
import type { StdcmTranslations } from '../../utils/types';

const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');

class DestinationSection extends STDCMPage {
  private readonly destinationChField: Locator;

  private readonly destinationCiField: Locator;

  readonly destinationArrival: Locator;

  readonly dateDestinationArrival: Locator;

  readonly timeDestinationArrival: Locator;

  readonly toleranceDestinationArrival: Locator;

  readonly dynamicDestinationCh: Locator;

  readonly dynamicDestinationCi: Locator;

  private readonly suggestionSS: Locator;

  private readonly closeDestinationTimePickerButton: Locator;

  private readonly clearButton: Locator;

  private readonly destinationIncrementTimeButton: Locator;

  constructor(page: Page) {
    super(page);

    this.destinationChField = this.destinationCard.getByTestId('operational-point-ch');
    this.destinationCiField = this.destinationCard.getByTestId('operational-point-ci');
    this.destinationArrival = page.locator('#select-destination-arrival');
    this.dateDestinationArrival = page.getByTestId('date-destination-arrival-input');
    this.timeDestinationArrival = page.getByTestId('time-destination-arrival-input');
    this.toleranceDestinationArrival = page.getByTestId('tolerance-destination-arrival-input');
    this.dynamicDestinationCh = this.destinationCard.getByTestId('operational-point-ch');
    this.dynamicDestinationCi = this.destinationCard.getByTestId('operational-point-ci');
    this.suggestionSS = this.suggestionItems.filter({
      hasText: 'SS South_station',
    });
    this.clearButton = this.destinationCard.locator('.clear-icon');
    this.destinationIncrementTimeButton = page.getByTestId(
      'time-destination-arrival-increment-minute'
    );
    this.closeDestinationTimePickerButton = page.getByTestId(
      'time-destination-arrival-modal-close-button'
    );
  }

  private async setMinuteLocator(minuteValue: string) {
    const minuteLocator = this.page.locator('.time-grid .minute', { hasText: minuteValue });
    await minuteLocator.click();
  }

  private async setHourLocator(hourValue: string) {
    const hourLocator = this.page.locator('.time-grid .hour', { hasText: hourValue });
    await hourLocator.click();
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

    // Fill destination input and verify suggestions
    await this.dynamicDestinationCi.fill(input);
    await this.verifyDestinationSouthSuggestions();
    await this.suggestionSS.click();
    const destinationCiValue = await this.dynamicDestinationCi.getAttribute('value');
    expect(destinationCiValue).toContain(suggestion);
    // Verify default values
    await expect(this.dynamicDestinationCh).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType.default);
    await this.launchSimulationButton.click();
    await expect(this.warningBox).toContainText(
      frTranslations.stdcmErrors.routeErrors.noScheduledPoint
    );
    await expect(this.dateDestinationArrival).not.toBeVisible();
    await expect(this.timeDestinationArrival).not.toBeVisible();
    await expect(this.toleranceDestinationArrival).not.toBeVisible();
    // Select 'preciseTime' and verify values
    await this.destinationArrival.selectOption(arrivalType.updated);
    await expect(this.destinationArrival).toHaveValue(arrivalType.updated);
    await expect(this.dateDestinationArrival).toHaveValue(arrivalDate);
    await expect(this.timeDestinationArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceDestinationArrival).toHaveValue(tolerance);
    // Update date and time values
    await this.dateDestinationArrival.fill(updatedDetails.date);
    await expect(this.dateDestinationArrival).toHaveValue(updatedDetails.date);
    await this.timeDestinationArrival.click();
    await this.setHourLocator(updatedDetails.hour);
    await this.setMinuteLocator(updatedDetails.minute);
    await this.destinationIncrementTimeButton.dblclick(); // Double-click the +1 minute button to reach 37
    await this.closeDestinationTimePickerButton.click();
    await expect(this.timeDestinationArrival).toHaveValue(updatedDetails.timeValue);

    // Update tolerance and verify warning box
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
    await this.dynamicDestinationCi.fill(input);
    await this.suggestionSS.click();
    await expect(this.dynamicDestinationCh).toHaveValue(chValue);
    await expect(this.destinationArrival).toHaveValue(arrivalType);
  }

  async clearDestination(): Promise<void> {
    await this.clearButton.click();

    await expect(this.destinationCiField).toHaveValue('');
  }
}

export default DestinationSection;
