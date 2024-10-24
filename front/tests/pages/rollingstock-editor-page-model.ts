import { expect, type Locator, type Page } from '@playwright/test';

import CommonPage from './common-page-model';
import { fillAndCheckInputById } from '../utils/index';

class RollingstockEditorPage extends CommonPage {
  readonly newRollingstockButton: Locator;

  readonly submitRollingstockButton: Locator;

  readonly rollingstockDetailsButton: Locator;

  readonly speedEffortCurvesButton: Locator;

  readonly rollingStockSpreadsheet: Locator;

  readonly rollingStockSearchInput: Locator;

  readonly rollingStockEditorList: Locator;

  readonly powerRestrictionSelector: Locator;

  readonly electricalProfileSelector: Locator;

  readonly loadingGauge: Locator;

  readonly tractionModeSelector: Locator;

  readonly confirmModalButtonYes: Locator;

  readonly addPowerRestrictionButton: Locator;

  readonly powerRestrictionModalBody: Locator;

  readonly selectedElectricalProfileButton: Locator;

  readonly deleteSelectedElectricalProfileButton: Locator;

  readonly editRollingStockButton: Locator;

  readonly duplicateRollingStockButton: Locator;

  readonly deleteRollingStockButton: Locator;

  constructor(page: Page) {
    super(page);
    this.newRollingstockButton = page.getByTestId('new-rollingstock-button');
    this.submitRollingstockButton = page.getByTestId('submit-rollingstock-button');
    this.rollingstockDetailsButton = page.getByTestId('tab-rollingstock-details');
    this.speedEffortCurvesButton = page.getByTestId('tab-rollingstock-curves');
    this.rollingStockSpreadsheet = page.locator('.dsg-container');
    this.rollingStockSearchInput = page.locator('#searchfilter');
    this.rollingStockEditorList = page.getByTestId('rollingstock-editor-list');
    this.powerRestrictionSelector = page.getByTestId('power-restriction-selector');
    this.electricalProfileSelector = page.getByTestId('electrical-profile-selector');
    this.loadingGauge = page.locator('#loadingGauge');
    this.tractionModeSelector = page.getByTestId('traction-mode-selector');
    this.confirmModalButtonYes = page.getByTestId('confirm-modal-button-yes');
    this.addPowerRestrictionButton = this.powerRestrictionSelector.getByRole('button').nth(1);
    this.powerRestrictionModalBody = page.locator('#modal-body');
    this.selectedElectricalProfileButton = this.electricalProfileSelector.getByRole('button');
    this.deleteSelectedElectricalProfileButton = this.selectedElectricalProfileButton.getByRole(
      'button',
      { name: 'Delete item', exact: true }
    );
    this.editRollingStockButton = page.getByTestId('rollingstock-edit-button');
    this.duplicateRollingStockButton = page.getByTestId('rollingstock-duplicate-button');
    this.deleteRollingStockButton = page.getByTestId('rollingstock-delete-button');
  }

  // Navigate to the Rolling Stock Editor Page
  async navigateToPage() {
    await this.page.goto('/rolling-stock-editor/');
    // Wait for the page to reach the network idle state
    await this.page.waitForLoadState('networkidle');
    await this.removeViteOverlay();
  }

  // Click the New Rolling Stock Button
  async clickOnNewRollingstockButton() {
    await this.newRollingstockButton.click();
  }

  // Search for a rolling stock
  async searchRollingStock(rollingStockName: string) {
    await this.rollingStockSearchInput.fill(rollingStockName);
  }

  // Clear the search for a rolling stock
  async clearSearchRollingStock() {
    await this.rollingStockSearchInput.clear();
  }

  // Select a rolling stock from the list
  async selectRollingStock(rollingStockName: string) {
    const rollingStockCard = this.page.getByTestId(`rollingstock-${rollingStockName}`);
    await rollingStockCard.click();
  }

  // Edit a rolling stock
  async editRollingStock(rollingStockName: string) {
    await this.selectRollingStock(rollingStockName);
    await this.editRollingStockButton.click();
  }

  // Click the Submit Rolling Stock Button
  async clickOnSubmitRollingstockButton() {
    await this.submitRollingstockButton.click();
  }

  // Click the Rolling Stock Details Button
  async clickOnRollingstockDetailsButton() {
    await this.rollingstockDetailsButton.click();
  }

  // Click the Speed Effort Curves Button
  async clickOnSpeedEffortCurvesButton() {
    await this.speedEffortCurvesButton.click();
  }

  // Get Velocity cell by row number
  getVelocityCellByRow(row: number) {
    return this.rollingStockSpreadsheet.locator('.dsg-row').nth(row).locator('.dsg-cell').nth(1);
  }

  // Get Velocity cell value by row number
  async getVelocityCellByRowValue(row: number) {
    return this.rollingStockSpreadsheet
      .locator('.dsg-row')
      .nth(row)
      .locator('.dsg-cell')
      .nth(1) // Assuming the second cell contains the velocity value
      .locator('input')
      .inputValue();
  }

  // Get Effort cell by row number
  getEffortCellByRow(row: number) {
    return this.rollingStockSpreadsheet.locator('.dsg-row').nth(row).locator('.dsg-cell').last();
  }

  // Get Effort cell value by row number
  // Note: This method assumes there are at least three cells per row.
  // If the structure changes, update the .nth() index accordingly.
  async getEffortCellByRowValue(row: number) {
    return this.rollingStockSpreadsheet
      .locator('.dsg-row')
      .nth(row)
      .locator('.dsg-cell')
      .nth(2) // Assuming the third cell contains the effort value
      .locator('input')
      .inputValue();
  }

  // Set spreadsheet cell value
  async setSpreadsheetCell(value: string, cell: Locator) {
    await cell.dblclick();
    await this.page.keyboard.press('Backspace');
    await Promise.all(
      value.split('').map(async (digit) => {
        await this.page.keyboard.press(digit);
      })
    );
  }

  // Set spreadsheet row value
  async setSpreadsheetRow(data: { row: number; velocity: string; effort: string }[]) {
    for (const { row, effort, velocity } of data) {
      const velocityCell = this.getVelocityCellByRow(row);
      const effortCell = this.getEffortCellByRow(row);
      await this.setSpreadsheetCell(velocity, velocityCell);
      await this.setSpreadsheetCell(effort, effortCell);
    }
  }

  // Select gauge value
  async selectLoadingGauge(value: string) {
    await this.loadingGauge.selectOption(value);
    expect(await this.loadingGauge.inputValue()).toBe(value);
  }

  // Fill speed effort curves with or without power restriction
  async fillSpeedEffortCurves(
    speedEffortData: { velocity: string; effort: string }[],
    isPowerRestrictionSpecified: boolean,
    powerRestrictionValue: string,
    electricalProfilesValue: string
  ) {
    if (!isPowerRestrictionSpecified) {
      await this.clickOnSpeedEffortCurvesButton();
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

  // Verify speed effort curves
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

  // Fill additional details
  async fillAdditionalDetails(details: {
    electricalPowerStartupTime: number;
    raisePantographTime: number;
  }) {
    await this.clickOnRollingstockDetailsButton();
    await fillAndCheckInputById(
      this.page,
      'electricalPowerStartupTime',
      details.electricalPowerStartupTime
    );
    await fillAndCheckInputById(this.page, 'raisePantographTime', details.raisePantographTime);
  }

  // Submit and confirm rolling stock creation
  async submitRollingStock() {
    await this.clickOnSubmitRollingstockButton();
    await this.confirmModalButtonYes.click();
  }

  // Duplicate rolling stock creation
  async duplicateRollingStock() {
    await this.duplicateRollingStockButton.click();
  }

  // Delete a rolling stock
  async deleteRollingStock(rollingStockName: string) {
    await this.selectRollingStock(rollingStockName);
    await this.deleteRollingStockButton.click();
    await this.confirmModalButtonYes.click();
  }
}
export default RollingstockEditorPage;
