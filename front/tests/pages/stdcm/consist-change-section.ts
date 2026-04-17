import { expect, type Locator, type Page } from '@playwright/test';

import {
  expectFieldsToHaveValues,
  handleAndVerifyInput,
  selectFirstDropDownItem,
} from '../../utils';
import type { ConsistChangeFields } from '../../utils/stdcm-types';
import ViaSection from './via-section';

class ConsistChangeSection extends ViaSection {
  constructor(page: Page) {
    super(page);
  }

  private getEditConsistButton(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('edit-consist');
  }

  private getDeleteConsistChangeButton(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('delete-consist-change-button');
  }

  private getConsistChangeCard(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('stdcm-via-delete-consist-change');
  }

  private getConsistChangeTonnage(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('tonnage-input');
  }

  private getConsistChangeLength(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('length-input');
  }

  private getConsistChangeTractionEngine(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('tractionEngine-input');
  }

  private getConsistChangeTowedRollingStock(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('towedRollingStock-input');
  }

  private getConsistChangeTowedRollingStockList(viaNumber: number): Locator {
    return this.getViaCard(viaNumber).getByTestId('towed-rolling-stock-list');
  }

  async selectConsistChangeTowedRollingStock(viaNumber: number, name: string): Promise<void> {
    await selectFirstDropDownItem(
      this.getConsistChangeTowedRollingStock(viaNumber),
      this.getConsistChangeTowedRollingStockList(viaNumber),
      name
    );
    await expect(this.getConsistChangeTowedRollingStock(viaNumber)).toHaveValue(name);
  }

  async verifyEditConsistButtonVisible(viaNumber: number): Promise<void> {
    await expect(this.getEditConsistButton(viaNumber)).toBeVisible();
  }

  async verifyEditConsistButtonHidden(viaNumber: number): Promise<void> {
    await expect(this.getEditConsistButton(viaNumber)).toBeHidden();
  }

  async verifyConsistChangeCardVisible(viaNumber: number): Promise<void> {
    await expect(this.getConsistChangeCard(viaNumber)).toBeVisible();
  }

  async verifyConsistChangeCardHidden(viaNumber: number): Promise<void> {
    await expect(this.getConsistChangeCard(viaNumber)).toBeHidden();
  }

  async clickEditConsist(viaNumber: number): Promise<void> {
    await expect(this.getEditConsistButton(viaNumber)).toBeEnabled();
    await this.getEditConsistButton(viaNumber).click();
    await this.verifyConsistChangeCardVisible(viaNumber);
  }

  async verifyConsistChangePrefilledValues(
    viaNumber: number,
    expectedValues: ConsistChangeFields
  ): Promise<void> {
    const fields: Array<[Locator, string]> = [];
    fields.push([this.getConsistChangeTractionEngine(viaNumber), expectedValues.tractionEngine]);
    if (expectedValues.towedRollingStock !== undefined) {
      fields.push([
        this.getConsistChangeTowedRollingStock(viaNumber),
        expectedValues.towedRollingStock,
      ]);
    }
    fields.push([this.getConsistChangeTonnage(viaNumber), expectedValues.tonnage]);
    fields.push([this.getConsistChangeLength(viaNumber), expectedValues.length]);
    await expectFieldsToHaveValues(fields);
  }

  async modifyConsistChangeFields(
    viaNumber: number,
    fields: Partial<ConsistChangeFields>
  ): Promise<void> {
    if (fields.towedRollingStock !== undefined) {
      await this.selectConsistChangeTowedRollingStock(viaNumber, fields.towedRollingStock);
    }
    await handleAndVerifyInput(this.getConsistChangeTonnage(viaNumber), fields.tonnage);
    await handleAndVerifyInput(this.getConsistChangeLength(viaNumber), fields.length);
  }

  async clearConsistChangeTonnage(viaNumber: number): Promise<void> {
    const tonnage = this.getConsistChangeTonnage(viaNumber);
    await tonnage.clear();
    await expect(tonnage).toHaveValue('');
  }

  async clearConsistChangeLength(viaNumber: number): Promise<void> {
    const length = this.getConsistChangeLength(viaNumber);
    await length.clear();
    await expect(length).toHaveValue('');
  }

  async deleteConsistChange(viaNumber: number): Promise<void> {
    await this.getDeleteConsistChangeButton(viaNumber).click();
    await this.verifyConsistChangeCardHidden(viaNumber);
  }
}

export default ConsistChangeSection;
