import { expect, type Locator, type Page } from '@playwright/test';

import { expectFieldsToHaveValues } from '../../utils';
import type {
  ViaSearchText,
  FillAndVerifyViaDetailsParams,
  VerifyViaDetailsParams,
} from '../../utils/stdcm-types';
import STDCMPage from './stdcm-page';

class ViaSection extends STDCMPage {
  private readonly viaIcon: Locator;
  private readonly viaDeleteButton: Locator;
  private readonly viaCards: Locator;

  constructor(page: Page) {
    super(page);
    this.viaIcon = page.getByTestId('stdcm-via-icons');
    this.viaDeleteButton = page.getByTestId('delete-via-button');
    this.viaCards = page.getByTestId('stdcm-via-card');
  }

  private getSuggestionByText(text: string): Locator {
    return this.suggestionItems.filter({ hasText: text });
  }

  private getViaCard(viaNumber: number): Locator {
    return this.viaCards.nth(viaNumber - 1);
  }

  private getViaCH(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('operational-point-ch');
  }

  private getViaCI(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('operational-point-ci');
  }

  private getViaType(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('stdcm-stop-type');
  }

  private getViaStopTime(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('stdcm-via-stop-time-input');
  }

  private getViaWarning(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('status-message-warning');
  }

  private getViaLocators(viaNumber: number): {
    ci: Locator;
    ch: Locator;
    type: Locator;
    stopTime: Locator;
    warning: Locator;
  } {
    return {
      ci: this.getViaCI(viaNumber),
      ch: this.getViaCH(viaNumber),
      type: this.getViaType(viaNumber),
      stopTime: this.getViaStopTime(viaNumber),
      warning: this.getViaWarning(viaNumber),
    };
  }

  private async fillAndVerifyStopTime(
    stopTimeInput: Locator,
    defaultValue: string,
    inputValue: string
  ): Promise<void> {
    await expect(stopTimeInput).toHaveValue(defaultValue);
    await stopTimeInput.fill(inputValue);
    await expect(stopTimeInput).toHaveValue(inputValue);
  }

  private async expectWarningMessage(warning: Locator, expectedMessage: string): Promise<void> {
    await expect(warning).toBeVisible();
    await expect(warning).toHaveText(expectedMessage);
  }

  private async expectNoWarningMessage(warning: Locator): Promise<void> {
    await expect(warning).not.toBeVisible();
  }

  private async addAndFillVia({
    viaNumber,
    ciSearchText,
    expectedChValue,
    selectedSuggestionText,
    defaultViaType,
  }: {
    viaNumber: number;
    ciSearchText: ViaSearchText;
    expectedChValue: string;
    selectedSuggestionText: string;
    defaultViaType: string;
  }): Promise<void> {
    const { ci, ch, type } = this.getViaLocators(viaNumber);
    const selectedSuggestion = this.getSuggestionByText(selectedSuggestionText);

    await this.addViaButton.nth(viaNumber - 1).click();
    await expect(this.addViaButton).toHaveCount(viaNumber + 1);

    await expect(ci).toBeVisible();
    await ci.fill(ciSearchText);

    await expect(selectedSuggestion).toBeVisible();
    await selectedSuggestion.click();

    await ch.click({ trial: true });
    await expect(ch).toHaveValue(expectedChValue);
    await expect(type).toHaveValue(defaultViaType);
  }

  async addAndDeletedDefaultVia(defaultPassageTimeType: string): Promise<void> {
    const viaNumber = 1;
    const { ci, ch, type } = this.getViaLocators(viaNumber);

    await this.addViaButton.click();

    await expect(this.viaCards).toBeVisible();
    await expectFieldsToHaveValues([
      [ci, ''],
      [ch, ''],
      [type, defaultPassageTimeType],
    ]);

    await this.viaIcon.hover();
    await expect(this.viaDeleteButton).toBeVisible();
    await this.viaDeleteButton.click();

    await expect(ci).toBeHidden();
    await expect(ch).toBeHidden();
    await expect(type).toBeHidden();
  }

  async fillAndVerifyViaDetails({
    viaNumber,
    ciSearchText,
    expectedChValue,
    stopTypes,
    stopTimes,
    suggestionTextBySearch,
    driverSwitchTooShortWarning,
  }: FillAndVerifyViaDetailsParams): Promise<void> {
    const viaLocators = this.getViaLocators(viaNumber);
    const selectedSuggestionText = suggestionTextBySearch[ciSearchText];

    await this.addAndFillVia({
      viaNumber,
      ciSearchText,
      expectedChValue,
      selectedSuggestionText,
      defaultViaType: stopTypes.PASSAGE_TIME,
    });

    switch (ciSearchText) {
      case 'mid_west':
        break;

      case 'mid_east':
        await viaLocators.type.selectOption(stopTypes.SERVICE_STOP);
        await this.fillAndVerifyStopTime(
          viaLocators.stopTime,
          stopTimes.serviceStop.default,
          stopTimes.serviceStop.input
        );
        break;

      case 'nS':
        await viaLocators.type.selectOption(stopTypes.DRIVER_SWITCH);

        await this.fillAndVerifyStopTime(
          viaLocators.stopTime,
          stopTimes.driverSwitch.default,
          stopTimes.driverSwitch.invalidInput
        );

        await this.expectWarningMessage(viaLocators.warning, driverSwitchTooShortWarning);

        await viaLocators.stopTime.fill(stopTimes.driverSwitch.validInput);
        await expect(viaLocators.stopTime).toHaveValue(stopTimes.driverSwitch.validInput);
        await this.expectNoWarningMessage(viaLocators.warning);
        break;

      default:
        throw new Error(`Unsupported viaSearch value: ${ciSearchText}`);
    }
  }

  async verifyViaDetails({
    viaNumber = 1,
    expectedCiValue,
    expectedViaType,
    expectedStopTime,
  }: VerifyViaDetailsParams): Promise<void> {
    const { ci, type, stopTime } = this.getViaLocators(viaNumber);
    await expectFieldsToHaveValues([
      [ci, expectedCiValue],
      [type, expectedViaType],
      [stopTime, expectedStopTime],
    ]);
  }
}

export default ViaSection;
