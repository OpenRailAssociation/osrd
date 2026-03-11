import { expect, type Locator, type Page } from '@playwright/test';

import STDCMPage from './stdcm-page';
import LINKED_TRAIN_DETAILS from '../../assets/constants/stdcm/linked-train-const';
import {
  CI_SUGGESTIONS,
  DEFAULT_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  ORIGIN_DETAILS,
} from '../../assets/constants/stdcm/stdcm-const';

class OriginSection extends STDCMPage {
  readonly originChField: Locator;
  readonly originCiField: Locator;
  readonly dateOriginArrival: Locator;
  readonly originArrival: Locator;
  readonly timeOriginArrival: Locator;
  readonly toleranceOriginArrival: Locator;
  private readonly suggestionNWS: Locator;

  constructor(page: Page) {
    super(page);
    this.originChField = this.originCard.getByTestId('operational-point-ch');
    this.originCiField = this.originCard.getByTestId('operational-point-ci');
    this.originArrival = page.locator('#select-origin-arrival');
    this.dateOriginArrival = page.getByTestId('date-origin-arrival-input');
    this.timeOriginArrival = page.getByTestId('time-origin-arrival-input');
    this.toleranceOriginArrival = page.getByTestId('tolerance-origin-arrival-input');
    this.suggestionNWS = this.suggestionItems.filter({ hasText: 'NWS North_West_station' });
  }

  async verifyDefaultOriginFields() {
    const { arrivalDate, arrivalTime, tolerance } = DEFAULT_DETAILS;
    await Promise.all(
      [this.originCiField, this.originChField].map((field) => expect(field).toHaveValue(''))
    );
    await expect(this.originArrival).toHaveValue(ORIGIN_DETAILS.arrivalType.default);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);
  }

  async verifyOriginDetails() {
    const { originCi, originCh, originArrival, dateOriginArrival, timeOriginArrival } =
      LINKED_TRAIN_DETAILS.anterior;
    await expect(this.originCiField).toHaveValue(originCi);
    await expect(this.originChField).toHaveValue(originCh);
    await expect(this.originArrival).toHaveValue(originArrival);
    await expect(this.dateOriginArrival).toHaveValue(dateOriginArrival);
    await expect(this.timeOriginArrival).toHaveValue(timeOriginArrival);
    await expect(this.toleranceOriginArrival).toHaveValue('-15/+15');
  }

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

    await this.originCiField.fill(input);
    await this.verifyOriginNorthSuggestions();
    await this.suggestionNWS.click();
    const originCiValue = await this.originCiField.getAttribute('value');
    expect(originCiValue).toContain(suggestion);
    await expect(this.originChField).toHaveValue(chValue);
    await expect(this.originArrival).toHaveValue(arrivalType.default);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);
    await this.originChField.selectOption(updatedChValue);
    await expect(this.originChField).toHaveValue(updatedChValue);
    await this.originArrival.selectOption(arrivalType.updated);
    await expect(this.originArrival).toHaveValue(arrivalType.updated);
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

    await this.originCiField.fill(input);
    await this.suggestionNWS.click();

    if (isPrecise && arrivalTypeOverride) {
      await this.originArrival.selectOption(arrivalTypeOverride);
    } else {
      await expect(this.originChField).toHaveValue(chValue);
      await expect(this.originArrival).toHaveValue(arrivalType);
      await this.dateOriginArrival.fill(arrivalDate);
      await this.timeOriginArrival.fill(arrivalTimeOverride ?? arrivalTime);
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
