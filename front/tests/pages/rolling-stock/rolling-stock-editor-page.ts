import { expect, type Locator, type Page } from '@playwright/test';

import { fillAndCheckInputById } from '../../utils';
import readJsonFile from '../../utils/file-utils';
import type { FlatTranslations } from '../../utils/types';
import CommonPage from '../common-page';

type RollingStockTranslations = FlatTranslations & { categoriesOptions: FlatTranslations };

const frTranslations = readJsonFile<{ rollingStock: RollingStockTranslations }>(
  'public/locales/fr/translation.json'
).rollingStock;

class RollingstockEditorPage extends CommonPage {
  private readonly rollingstockEditorList: Locator;

  private readonly rollingstockCard: Locator;

  private readonly newRollingstockButton: Locator;

  private readonly submitRollingstockButton: Locator;

  private readonly rollingstockDetailsButton: Locator;

  private readonly speedEffortCurvesButton: Locator;

  private readonly rollingStockSpreadsheet: Locator;

  private readonly rollingStockSearchInput: Locator;

  private readonly powerRestrictionSelector: Locator;

  private readonly electricalProfileSelector: Locator;

  private readonly loadingGauge: Locator;

  private readonly primaryCategorySelector: Locator;

  private readonly tractionModeSelector: Locator;

  private readonly confirmModalButtonYes: Locator;

  private readonly addPowerRestrictionButton: Locator;

  private readonly powerRestrictionModalBody: Locator;

  private readonly selectedElectricalProfileButton: Locator;

  private readonly deleteSelectedElectricalProfileButton: Locator;

  private readonly editRollingStockButton: Locator;

  private readonly duplicateRollingStockButton: Locator;

  private readonly deleteRollingStockButton: Locator;

  constructor(page: Page) {
    super(page);
    this.rollingstockEditorList = page.getByTestId('rollingstock-editor-list');
    this.rollingstockCard = this.rollingstockEditorList.getByTestId(/^rollingstock-/);
    this.newRollingstockButton = page.getByTestId('new-rollingstock-button');
    this.submitRollingstockButton = page.getByTestId('submit-rollingstock-button');
    this.rollingstockDetailsButton = page.getByTestId('tab-rollingstock-details');
    this.speedEffortCurvesButton = page.getByTestId('tab-rollingstock-curves');
    this.rollingStockSpreadsheet = page.locator('.dsg-container');
    this.rollingStockSearchInput = page.getByTestId('searchfilter-input');
    this.powerRestrictionSelector = page.getByTestId('power-restriction-selector');
    this.electricalProfileSelector = page.getByTestId('electrical-profile-selector');
    this.loadingGauge = page.getByTestId('loadingGauge-select');
    this.primaryCategorySelector = page.getByTestId('primary-category-selector-select');
    this.tractionModeSelector = page.getByTestId('traction-mode-selector');
    this.confirmModalButtonYes = page.getByTestId('confirm-modal-button-yes');
    this.addPowerRestrictionButton = this.powerRestrictionSelector.getByRole('button').nth(1);
    this.powerRestrictionModalBody = page.getByTestId('modal-body');
    this.selectedElectricalProfileButton = this.electricalProfileSelector.getByRole('button');
    this.deleteSelectedElectricalProfileButton = this.selectedElectricalProfileButton.getByRole(
      'button',
      { name: 'Delete item', exact: true }
    );
    this.editRollingStockButton = page.getByTestId('rollingstock-edit-button');
    this.duplicateRollingStockButton = page.getByTestId('rollingstock-duplicate-button');
    this.deleteRollingStockButton = page.getByTestId('rollingstock-delete-button');
  }

  private getCategoryCheckboxLocator(rollingstockCategory: string): Locator {
    return this.page.getByTestId(`category-checkbox-${rollingstockCategory}-checkbox`);
  }

  async navigateToRollingStockPage() {
    await this.page.goto('/rolling-stock-editor/');
    await this.removeViteOverlay();
  }

  async openNewRollingStockForm() {
    await this.newRollingstockButton.click();
  }

  async verifyFirstRollingStockCardVisibility() {
    await expect(this.rollingstockCard.first()).toBeVisible();
  }

  async searchRollingStock(rollingStockName: string) {
    await this.rollingStockSearchInput.fill(rollingStockName);
    await this.waitForLoaderToDisappear();
  }

  async clearSearchRollingStock() {
    await this.rollingStockSearchInput.clear();
    await this.waitForLoaderToDisappear();
  }

  async selectRollingStock(rollingStockName: string) {
    const rollingStockCard = this.page.getByTestId(`rollingstock-${rollingStockName}`);
    await rollingStockCard.click();
  }

  async editRollingStock(rollingStockName: string) {
    await this.selectRollingStock(rollingStockName);
    await this.editRollingStockButton.click();
  }

  async submitRollingstock() {
    await this.submitRollingstockButton.click();
  }

  private async openRollingStockDetails() {
    await this.rollingstockDetailsButton.click();
  }

  async openSpeedEffortCurves() {
    await this.speedEffortCurvesButton.click();
  }

  private getVelocityCellByRow(row: number) {
    return this.rollingStockSpreadsheet.locator('.dsg-row').nth(row).locator('.dsg-cell').nth(1);
  }

  private async getVelocityCellByRowValue(row: number) {
    return this.rollingStockSpreadsheet
      .locator('.dsg-row')
      .nth(row)
      .locator('.dsg-cell')
      .nth(1) // Assuming the second cell contains the velocity value
      .locator('input')
      .inputValue();
  }

  private getEffortCellByRow(row: number) {
    return this.rollingStockSpreadsheet.locator('.dsg-row').nth(row).locator('.dsg-cell').last();
  }

  // Get Effort cell value by row number
  // Note: This method assumes there are at least three cells per row.
  // If the structure changes, update the .nth() index accordingly.
  private async getEffortCellByRowValue(row: number) {
    return this.rollingStockSpreadsheet
      .locator('.dsg-row')
      .nth(row)
      .locator('.dsg-cell')
      .nth(2) // Assuming the third cell contains the effort value
      .locator('input')
      .inputValue();
  }

  // Set spreadsheet cell value
  private async setSpreadsheetCell(value: string, cell: Locator) {
    await cell.dblclick();
    await this.page.keyboard.press('Backspace');
    await Promise.all(
      value.split('').map(async (digit) => {
        await this.page.keyboard.press(digit);
      })
    );
  }

  async selectLoadingGauge(value: string) {
    await this.loadingGauge.selectOption(value);
    expect(await this.loadingGauge.inputValue()).toBe(value);
  }

  async selectPrimaryCategory(value: string) {
    await this.primaryCategorySelector.selectOption(value);
    await expect(this.primaryCategorySelector).toHaveValue(value);
    const checkbox = this.getCategoryCheckboxLocator(value);
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();
  }

  async checkCategoryCheckbox(category: string) {
    const checkbox = this.getCategoryCheckboxLocator(category);
    await expect(checkbox).not.toBeChecked();
    await checkbox.locator('..').locator('label').click();
    await expect(checkbox).toBeChecked();
  }

  async uncheckCategoryCheckbox(category: string) {
    const checkbox = this.getCategoryCheckboxLocator(category);
    await expect(checkbox).toBeChecked();
    await checkbox.locator('..').locator('label').click();
    await expect(checkbox).not.toBeChecked();
  }

  async fillSpeedEffortCurves(
    speedEffortData: { velocity: string; effort: string }[],
    isPowerRestrictionSpecified: boolean,
    powerRestrictionValue: string,
    electricalProfilesValue: string
  ) {
    if (!isPowerRestrictionSpecified) {
      await this.openSpeedEffortCurves();
      await this.tractionModeSelector.getByRole('button').click();
      await this.tractionModeSelector
        .getByRole('button', { name: electricalProfilesValue, exact: true })
        .click();
      await expect(this.tractionModeSelector.getByTitle(electricalProfilesValue)).toBeVisible();
    }

    await this.fillSpeedEffortData(
      speedEffortData,
      isPowerRestrictionSpecified,
      powerRestrictionValue,
      false
    );
  }

  // Fill speed effort data from JSON with or without power restriction
  async fillSpeedEffortData(
    data: { velocity: string; effort: string }[],
    isPowerRestrictionSpecified: boolean,
    powerRestrictionValue: string,
    toBeUpdated: boolean
  ) {
    if (isPowerRestrictionSpecified && !toBeUpdated) {
      await this.addPowerRestrictionButton.click();
      await this.powerRestrictionModalBody
        .getByTitle(powerRestrictionValue, { exact: true })
        .click();
      await expect(
        this.powerRestrictionSelector.getByTitle(powerRestrictionValue.replace(/\s/g, ''))
      ).toBeVisible();
    }
    if (toBeUpdated) {
      await this.powerRestrictionSelector
        .getByTitle(powerRestrictionValue, { exact: true })
        .click();
    }

    for (const rowData of data) {
      const rowIndex = data.indexOf(rowData) + 1;
      const velocityCell = this.getVelocityCellByRow(rowIndex);
      const effortCell = this.getEffortCellByRow(rowIndex);
      await this.setSpreadsheetCell(rowData.velocity, velocityCell);
      await this.setSpreadsheetCell(rowData.effort, effortCell);
    }
  }

  async verifySpeedEffortCurves(
    expectedData: { velocity: string; effort: string }[],
    isPowerRestrictionSpecified: boolean,
    powerRestrictionValue: string
  ) {
    if (isPowerRestrictionSpecified) {
      await this.powerRestrictionSelector
        .getByRole('button', { name: powerRestrictionValue })
        .click();
    }

    for (const rowData of expectedData) {
      const rowIndex = expectedData.indexOf(rowData) + 1;
      const velocityCell = await this.getVelocityCellByRowValue(rowIndex);
      const effortCell = await this.getEffortCellByRowValue(rowIndex);
      expect(velocityCell).toBe(rowData.velocity);
      expect(effortCell).toBe(rowData.effort);
    }
  }

  // Delete Electrical profile from the speed effort curves
  async deleteElectricalProfile(electricalProfileValue: string) {
    await this.selectedElectricalProfileButton.getByTitle(electricalProfileValue).hover();
    await this.deleteSelectedElectricalProfileButton.click();
    await this.confirmModalButtonYes.click();
    await expect(
      this.selectedElectricalProfileButton.getByTitle(electricalProfileValue)
    ).toBeHidden();
  }

  async fillAdditionalDetails(details: {
    electricalPowerStartupTime: number;
    raisePantographTime: number;
  }) {
    await this.openRollingStockDetails();
    await fillAndCheckInputById(
      this.page,
      'electricalPowerStartupTime',
      details.electricalPowerStartupTime
    );
    await fillAndCheckInputById(this.page, 'raisePantographTime', details.raisePantographTime);
  }

  async confirmRollingStockCreation() {
    await this.submitRollingstock();
    await this.confirmModalButtonYes.click();
  }

  async duplicateRollingStock() {
    await this.duplicateRollingStockButton.click();
  }

  async deleteRollingStock(rollingStockName: string) {
    await this.selectRollingStock(rollingStockName);
    await this.deleteRollingStockButton.click();
    await this.confirmModalButtonYes.click();
  }

  async verifyRollingStockDetailsTable(
    expectedValues: { id: string; value: string | string[]; isTranslated?: boolean }[]
  ) {
    for (const { id, value, isTranslated } of expectedValues) {
      let expectedValue = value;
      // Convert translated fields
      if (isTranslated) {
        if (Array.isArray(value)) {
          expectedValue = value.map(
            (v) => frTranslations.categoriesOptions[v] || frTranslations[v]
          );
        } else {
          expectedValue = frTranslations.categoriesOptions[value] || frTranslations[value];
        }
      }

      // Locate and verify values
      const row = this.page.getByRole('row', { name: frTranslations[id] }).first();
      await expect(row).toBeVisible();

      const valueCell = row.getByRole('cell').nth(1);
      await expect(valueCell).toBeVisible();

      const actualValue = await valueCell.textContent();
      expect(actualValue?.trim()).toBe(
        Array.isArray(expectedValue) ? expectedValue.join(', ') : expectedValue.toString()
      );
    }
  }
}
export default RollingstockEditorPage;
