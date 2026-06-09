import { expect, type Locator, type Page } from '@playwright/test';

import { EMPTY_SELECT_VALUE } from '../../assets/constants/stdcm/stdcm-const';
import type {
  DefaultOriginFields,
  ExpectedOriginDetails,
  LightOriginDetailsData,
  OriginDetailsData,
} from '../../utils/stdcm-types';
import STDCMPage from './stdcm-page';

class OriginSection extends STDCMPage {
  readonly originSecondaryCodeField: Locator;
  readonly originCiField: Locator;
  readonly dateOriginArrival: Locator;
  readonly originArrival: Locator;
  readonly timeOriginArrival: Locator;
  readonly toleranceOriginArrival: Locator;

  constructor(page: Page) {
    super(page);
    this.originSecondaryCodeField = this.originCard.getByTestId('operational-point-secondary-code');
    this.originCiField = this.originCard.getByTestId('operational-point-ci');
    this.originArrival = page.getByTestId('select-origin-arrival');
    this.dateOriginArrival = page.getByTestId('date-origin-arrival-input');
    this.timeOriginArrival = page.getByTestId('time-origin-arrival-input');
    this.toleranceOriginArrival = page.getByTestId('tolerance-origin-arrival-input');
  }

  private getSuggestionByText(text: string): Locator {
    return this.suggestionItems.filter({ hasText: text });
  }

  private async selectOrigin({
    input,
    expectedCiValue,
    expectedSuggestions,
  }: {
    input: string;
    expectedCiValue: string;
    expectedSuggestions: string[];
  }): Promise<void> {
    await this.originCiField.fill(input);
    await this.verifySuggestions(expectedSuggestions);
    await this.getSuggestionByText(expectedCiValue).click();
    await expect(this.originCiField).toHaveValue(expectedCiValue);
  }

  async verifyDefaultOriginFields({
    arrivalType,
    arrivalDate,
    arrivalTime,
    tolerance,
  }: DefaultOriginFields): Promise<void> {
    await expect(this.originCiField).toHaveValue('');
    await expect(this.originSecondaryCodeField).toHaveValue(EMPTY_SELECT_VALUE);
    await expect(this.originArrival).toHaveValue(arrivalType);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);
  }

  async verifyOriginDetails(expectedDetails: ExpectedOriginDetails): Promise<void> {
    const {
      originCi,
      originCh,
      originArrival,
      dateOriginArrival,
      timeOriginArrival,
      toleranceOriginArrival,
    } = expectedDetails;

    await expect(this.originCiField).toHaveValue(originCi);
    await expect(this.originSecondaryCodeField).toHaveValue(originCh);
    await expect(this.originArrival).toHaveValue(originArrival);
    await expect(this.dateOriginArrival).toHaveValue(dateOriginArrival);
    await expect(this.timeOriginArrival).toHaveValue(timeOriginArrival);
    await expect(this.toleranceOriginArrival).toHaveValue(toleranceOriginArrival);
  }

  async fillAndVerifyOriginDetails(originDetails: OriginDetailsData): Promise<void> {
    const {
      input,
      expectedCiValue,
      expectedSuggestions,
      chValue,
      arrivalDate,
      arrivalTime,
      tolerance,
      updatedChValue,
      arrivalType,
    } = originDetails;

    await this.selectOrigin({
      input,
      expectedCiValue,
      expectedSuggestions,
    });

    await expect(this.originSecondaryCodeField).toHaveValue(EMPTY_SELECT_VALUE);
    await expect(this.originArrival).toHaveValue(arrivalType.default);
    await expect(this.dateOriginArrival).toHaveValue(arrivalDate);
    await expect(this.timeOriginArrival).toHaveValue(arrivalTime);
    await expect(this.toleranceOriginArrival).toHaveValue(tolerance);

    await this.originSecondaryCodeField.selectOption(chValue);
    await expect(this.originSecondaryCodeField).toHaveValue(chValue);
    await this.originSecondaryCodeField.selectOption(updatedChValue);
    await expect(this.originSecondaryCodeField).toHaveValue(updatedChValue);

    await this.originArrival.selectOption(arrivalType.updated);
    await expect(this.originArrival).toHaveValue(arrivalType.updated);

    await expect(this.dateOriginArrival).not.toBeVisible();
    await expect(this.timeOriginArrival).not.toBeVisible();
    await expect(this.toleranceOriginArrival).not.toBeVisible();
  }

  async fillOriginDetailsLight({
    originDetails,
    expectedSuggestions,
    expectedCiValue,
    arrivalTimeOverride,
    arrivalTypeOverride,
    isPrecise = false,
  }: {
    originDetails: LightOriginDetailsData;
    expectedSuggestions: string[];
    expectedCiValue: string;
    arrivalTimeOverride?: string;
    arrivalTypeOverride?: string;
    isPrecise?: boolean;
  }): Promise<void> {
    const { input, chValue, arrivalDate, arrivalTime, tolerance, arrivalType } = originDetails;

    await this.selectOrigin({
      input,
      expectedCiValue,
      expectedSuggestions,
    });

    await this.originSecondaryCodeField.selectOption(chValue);
    await expect(this.originSecondaryCodeField).toHaveValue(chValue);

    if (isPrecise && arrivalTypeOverride) {
      await this.originArrival.selectOption(arrivalTypeOverride);
      return;
    }
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

export default OriginSection;
