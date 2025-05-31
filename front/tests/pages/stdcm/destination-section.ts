import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import {
  CI_SUGGESTIONS,
  DESTINATION_DETAILS,
  LIGHT_DESTINATION_DETAILS,
} from '../../assets/constants/stdcm-const';
import { getTranslations } from '../../utils';
import readJsonFile from '../../utils/file-utils';
import type { StdcmTranslations } from '../../utils/types';

const enTranslations: StdcmTranslations = readJsonFile('public/locales/en/stdcm.json');
const frTranslations: StdcmTranslations = readJsonFile('public/locales/fr/stdcm.json');
const deTranslations: StdcmTranslations = readJsonFile('public/locales/de/stdcm.json');

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

  private readonly clearButton: Locator;

  constructor(page: Page) {
    super(page);

    this.destinationChField = this.destinationCard.getByTestId('operational-point-ch');
    this.destinationCiField = this.destinationCard.getByTestId('operational-point-ci');
    this.destinationArrival = page.locator('#select-destination-arrival');
    this.dateDestinationArrival = page.locator('#date-destination-arrival');
    this.timeDestinationArrival = page.locator('#time-destination-arrival');
    this.toleranceDestinationArrival = page.locator('#stdcm-tolerance-destination-arrival');
    this.dynamicDestinationCh = this.destinationCard.getByTestId('operational-point-ch');
    this.dynamicDestinationCi = this.destinationCard.getByTestId('operational-point-ci');
    this.suggestionSS = this.suggestionList.locator('.suggestion-item', {
      hasText: 'SS South_station',
    });
    this.clearButton = this.destinationCard.locator('.clear-icon');
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
    const translations = getTranslations({
      en: enTranslations,
      de: deTranslations,
      fr: frTranslations,
    });
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
      translations.stdcmErrors.routeErrors.noScheduledPoint
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
    await this.incrementButton.dblclick(); // Double-click the +1 minute button to reach 37
    await this.closeTimePickerButton.click();
    await expect(this.timeDestinationArrival).toHaveValue(updatedDetails.timeValue);

    // Update tolerance and verify warning box
    await this.fillToleranceField(
      this.toleranceDestinationArrival,
      updatedDetails.tolerance.negative,
      updatedDetails.tolerance.positive
    );
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
