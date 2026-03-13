import { expect, type Locator, type Page } from '@playwright/test';

import {
  expectFieldsToHaveValues,
  handleAndVerifyInput,
  selectFirstDropDownItem,
} from '../../utils';
import type {
  ConsistFields,
  EditableConsistFields,
  ExpectedPrefilledValues,
  FillAndVerifyConsistDetailsParams,
  TowedPrefilledValuesParams,
} from '../../utils/stdcm-types';

class ConsistSection {
  readonly page: Page;
  private readonly tractionEngineField: Locator;
  private readonly tractionEngineAutocompleteList: Locator;
  private readonly towedRollingStockField: Locator;
  private readonly towedRollingStockAutocompleteList: Locator;
  private readonly tonnageField: Locator;
  private readonly lengthField: Locator;
  private readonly speedLimitTagField: Locator;
  private readonly maxSpeedField: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tractionEngineField = page.getByTestId('tractionEngine-input');
    this.tractionEngineAutocompleteList = page.getByTestId('traction-engine-list');
    this.towedRollingStockField = page.getByTestId('towedRollingStock-input');
    this.towedRollingStockAutocompleteList = page.getByTestId('towed-rolling-stock-list');
    this.tonnageField = page.getByTestId('tonnage-input');
    this.lengthField = page.getByTestId('length-input');
    this.speedLimitTagField = page.getByTestId('speed-limit-by-tag-selector');
    this.maxSpeedField = page.getByTestId('maxSpeed-input');
  }

  private async fillEditableConsistFields(fields: EditableConsistFields): Promise<void> {
    const { tonnage, length, maxSpeed } = fields;

    await handleAndVerifyInput(this.tonnageField, tonnage);
    await handleAndVerifyInput(this.lengthField, length);
    await handleAndVerifyInput(this.maxSpeedField, maxSpeed);
  }

  private async selectRollingStockAndVerifyPrefilledValues(
    field: Locator,
    list: Locator,
    value: string | undefined,
    expectedValues: ExpectedPrefilledValues,
    expectedMaxSpeed: string
  ): Promise<void> {
    if (!value) return;

    await selectFirstDropDownItem(field, list, value);

    await expectFieldsToHaveValues([
      [this.tonnageField, expectedValues.expectedTonnage],
      [this.lengthField, expectedValues.expectedLength],
      [this.maxSpeedField, expectedMaxSpeed],
    ]);
  }

  private async selectSpeedLimitTag(value?: string): Promise<void> {
    if (!value) return;

    await this.speedLimitTagField.selectOption(value);
    await expect(this.speedLimitTagField).toHaveValue(value);
  }

  private getTowedPrefilledValues({
    tractionEngineTonnage,
    tractionEngineLength,
    towedRollingStockTonnage,
    towedRollingStockLength,
  }: TowedPrefilledValuesParams): ExpectedPrefilledValues {
    const getCombinedValue = (tractionValue: string, towedValue?: string): string =>
      towedValue ? String(Number(tractionValue) + Number(towedValue)) : '0';

    return {
      expectedTonnage: getCombinedValue(tractionEngineTonnage, towedRollingStockTonnage),
      expectedLength: getCombinedValue(tractionEngineLength, towedRollingStockLength),
    };
  }

  async verifyDefaultConsistFields(params: { defaultSpeedLimitTag: string }): Promise<void> {
    await expectFieldsToHaveValues([
      [this.tractionEngineField, ''],
      [this.towedRollingStockField, ''],
      [this.tonnageField, ''],
      [this.lengthField, ''],
      [this.maxSpeedField, ''],
      [this.speedLimitTagField, params.defaultSpeedLimitTag],
    ]);
  }

  async fillAndVerifyConsistDetails({
    consistFields,
    defaultMaxSpeed,
    tractionEnginePrefilledValues,
    towedRollingStockPrefilledValues,
  }: FillAndVerifyConsistDetailsParams): Promise<void> {
    const { tractionEngine, towedRollingStock, tonnage, length, speedLimitTag } = consistFields;

    await this.selectRollingStockAndVerifyPrefilledValues(
      this.tractionEngineField,
      this.tractionEngineAutocompleteList,
      tractionEngine,
      tractionEnginePrefilledValues,
      defaultMaxSpeed
    );

    await this.selectRollingStockAndVerifyPrefilledValues(
      this.towedRollingStockField,
      this.towedRollingStockAutocompleteList,
      towedRollingStock,
      this.getTowedPrefilledValues({
        tractionEngineTonnage: tractionEnginePrefilledValues.expectedTonnage,
        tractionEngineLength: tractionEnginePrefilledValues.expectedLength,
        towedRollingStockTonnage: towedRollingStockPrefilledValues?.tonnage,
        towedRollingStockLength: towedRollingStockPrefilledValues?.length,
      }),
      defaultMaxSpeed
    );

    await this.fillEditableConsistFields({
      tonnage,
      length,
      maxSpeed: defaultMaxSpeed,
    });

    await this.selectSpeedLimitTag(speedLimitTag);
  }

  async verifyConsistDetails(consistFields: ConsistFields): Promise<void> {
    await expectFieldsToHaveValues([
      [this.tractionEngineField, consistFields.tractionEngine ?? ''],
      [this.towedRollingStockField, consistFields.towedRollingStock ?? ''],
      [this.tonnageField, consistFields.tonnage ?? ''],
      [this.lengthField, consistFields.length ?? ''],
      [this.maxSpeedField, consistFields.maxSpeed ?? ''],
      [this.speedLimitTagField, consistFields.speedLimitTag ?? ''],
    ]);
  }

  async setTonnage(value: string): Promise<void> {
    await handleAndVerifyInput(this.tonnageField, value);
  }

  async setLength(value: string): Promise<void> {
    await handleAndVerifyInput(this.lengthField, value);
  }

  async setMaxSpeed(value: string): Promise<void> {
    await handleAndVerifyInput(this.maxSpeedField, value);
  }

  async clearLength(): Promise<void> {
    await this.lengthField.clear();
    await expect(this.lengthField).toHaveValue('');
  }
}

export default ConsistSection;
