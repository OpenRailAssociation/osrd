import { expect, type Locator, type Page } from '@playwright/test';

import { DEFAULT_DETAILS } from '../../assets/constants/stdcm-const';
import { handleAndVerifyInput } from '../../utils';
import type { ConsistFields } from '../../utils/types';

class ConsistSection {
  readonly page: Page;

  private readonly tractionEngineField: Locator;

  private readonly towedRollingStockField: Locator;

  private readonly tonnageField: Locator;

  private readonly lengthField: Locator;

  private readonly speedLimitTagField: Locator;

  private readonly maxSpeedField: Locator;

  constructor(page: Page) {
    this.page = page;
    this.towedRollingStockField = page.getByTestId('towedRollingStock-input');
    this.tonnageField = page.getByTestId('tonnage-input');
    this.lengthField = page.getByTestId('length-input');
    this.speedLimitTagField = page.locator('#speed-limit-by-tag-selector');
    this.maxSpeedField = page.getByTestId('maxSpeed-input');
    this.tractionEngineField = page.getByTestId('tractionEngine-input');
  }

  async verifyDefaultConsistFields() {
    const emptyFields = [
      this.tractionEngineField,
      this.towedRollingStockField,
      this.tonnageField,
      this.lengthField,
      this.maxSpeedField,
    ];
    for (const field of emptyFields) await expect(field).toHaveValue('');
    await expect(this.speedLimitTagField).toHaveValue(DEFAULT_DETAILS.speedLimitTag);
  }

  async fillAndVerifyConsistDetails(
    consistFields: ConsistFields,
    tractionEngineTonnage: string,
    tractionEngineLength: string,
    towedRollingStockTonnage?: string,
    towedRollingStockLength?: string
  ): Promise<void> {
    const { tractionEngine, towedRollingStock, tonnage, length, speedLimitTag } = consistFields;

    // Generic utility for handling dropdown selection and value verification
    const handleAndVerifyDropdown = async (
      dropdownField: Locator,
      expectedValues: { expectedTonnage: string; expectedLength: string },
      selectedValue?: string
    ) => {
      if (!selectedValue) return;

      await dropdownField.fill(selectedValue);
      await dropdownField.press('ArrowDown');
      await dropdownField.press('Enter');
      await dropdownField.blur();
      await expect(dropdownField).toHaveValue(selectedValue);

      const { expectedTonnage, expectedLength } = expectedValues;
      await expect(this.tonnageField).toHaveValue(expectedTonnage);
      await expect(this.lengthField).toHaveValue(expectedLength);
      await expect(this.maxSpeedField).toHaveValue(DEFAULT_DETAILS.maxSpeed);
    };

    // Utility to calculate prefilled values for towed rolling stock
    const calculateTowedPrefilledValues = () => {
      if (!towedRollingStockTonnage || !towedRollingStockLength) {
        return { expectedTonnage: '0', expectedLength: '0' };
      }

      return {
        expectedTonnage: (
          parseFloat(towedRollingStockTonnage) + parseFloat(tractionEngineTonnage)
        ).toString(),
        expectedLength: (
          parseFloat(towedRollingStockLength) + parseFloat(tractionEngineLength)
        ).toString(),
      };
    };

    // Calculate prefilled values for the towed rolling stock
    const towedPrefilledValues = calculateTowedPrefilledValues();

    // Fill and verify traction engine dropdown
    await handleAndVerifyDropdown(
      this.tractionEngineField,
      {
        expectedTonnage: tractionEngineTonnage,
        expectedLength: tractionEngineLength,
      },
      tractionEngine
    );

    // Fill and verify towed rolling stock dropdown
    await handleAndVerifyDropdown(
      this.towedRollingStockField,
      towedPrefilledValues,
      towedRollingStock
    );

    // Fill and verify individual fields
    await handleAndVerifyInput(this.tonnageField, tonnage);
    await handleAndVerifyInput(this.lengthField, length);
    await handleAndVerifyInput(this.maxSpeedField, DEFAULT_DETAILS.maxSpeed);

    // Handle optional speed limit tag
    if (speedLimitTag) {
      await this.speedLimitTagField.selectOption(speedLimitTag);
      await expect(this.speedLimitTagField).toHaveValue(speedLimitTag);
    }
  }

  // Set consist values
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
    await handleAndVerifyInput(this.lengthField, '');
  }
}

export default ConsistSection;
