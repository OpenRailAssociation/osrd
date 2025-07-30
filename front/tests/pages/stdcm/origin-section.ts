import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import {
  CI_SUGGESTIONS,
  DEFAULT_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  ORIGIN_DETAILS,
} from '../../assets/constants/stdcm-const';

class OriginSection extends STDCMPage {
  private readonly originChField: Locator;

  private readonly originCiField: Locator;

  readonly dateOriginArrival: Locator;

  readonly originArrival: Locator;

  readonly timeOriginArrival: Locator;

  readonly toleranceOriginArrival: Locator;

  readonly dynamicOriginCh: Locator;

  readonly dynamicOriginCi: Locator;

  private readonly suggestionNWS: Locator;

  constructor(page: Page) {
    super(page);

    this.originChField = this.originCard.getByTestId('operational-point-ch');
    this.originCiField = this.originCard.getByTestId('operational-point-ci');
    this.originArrival = page.locator('#select-origin-arrival');
    this.dateOriginArrival = page.getByTestId('date-origin-arrival-input');
    this.timeOriginArrival = page.getByTestId('time-origin-arrival-input');
    this.toleranceOriginArrival = page.getByTestId('tolerance-origin-arrival-input');
    this.dynamicOriginCi = this.originCard.getByTestId('operational-point-ci');
    this.dynamicOriginCh = this.originCard.getByTestId('operational-point-ch');
    this.suggestionNWS = this.suggestionItems.filter({
      hasText: 'NWS North_West_station',
    });
  }

  async verifyDefaultOriginFields() {
    const { arrivalDate, arrivalTime, tolerance } = DEFAULT_DETAILS;
    const emptyFields = [this.originCiField, this.originChField];
    for (const field of emptyFields) await expect(field).toHaveValue('');
    await expect(this.originArrival).toHaveValue(ORIGIN_DETAILS.arrivalType.default);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);
  }

  // Verify the origin suggestions when searching for north
  private async verifyOriginNorthSuggestions() {
    await this.verifySuggestions(CI_SUGGESTIONS.north);
  }

  async fillAndVerifyOriginDetails() {
    const {
      input,
      suggestion,
      chValue,
      arrivalDate,
      arrivalTime,
      tolerance,
      updatedChValue,
      arrivalType,
    } = ORIGIN_DETAILS;
    // Fill and verify origin CI suggestions
    await this.dynamicOriginCi.fill(input);
    await this.verifyOriginNorthSuggestions();
    await this.suggestionNWS.click();
    const originCiValue = await this.dynamicOriginCi.getAttribute('value');
    expect(originCiValue).toContain(suggestion);
    // Verify default values
    await expect(this.dynamicOriginCh).toHaveValue(chValue);
    await expect(this.originArrival).toHaveValue(arrivalType.default);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);
    // Update and verify origin values
    await this.dynamicOriginCh.selectOption(updatedChValue);
    await expect(this.dynamicOriginCh).toHaveValue(updatedChValue);
    await this.originArrival.selectOption(arrivalType.updated);
    await expect(this.originArrival).toHaveValue(arrivalType.updated);
    // Verify fields are hidden
    await expect(this.dateOriginArrival).not.toBeVisible();
    await expect(this.timeOriginArrival).not.toBeVisible();
    await expect(this.toleranceOriginArrival).not.toBeVisible();
  }

  async fillOriginDetailsLight(
    arrivalTimeOverride?: string,
    arrivalTypeOverride: string = '',
    isPrecise: boolean = false
  ) {
    const { input, chValue, arrivalDate, arrivalTime, tolerance, arrivalType } =
      LIGHT_ORIGIN_DETAILS;
    await this.dynamicOriginCi.fill(input);
    await this.suggestionNWS.click();
    if (isPrecise && arrivalTypeOverride) {
      await this.originArrival.selectOption(arrivalTypeOverride);
    } else {
      await expect(this.dynamicOriginCh).toHaveValue(chValue);
      await expect(this.originArrival).toHaveValue(arrivalType);
      await this.dateOriginArrival.fill(arrivalDate);
      await this.timeOriginArrival.fill(arrivalTimeOverride || arrivalTime);
      await this.fillToleranceField({
        toleranceInput: this.toleranceOriginArrival,
        minusValue: tolerance.negative,
        plusValue: tolerance.positive,
        toleranceOp: 'origin',
      });
    }
  }
}

export default OriginSection;
