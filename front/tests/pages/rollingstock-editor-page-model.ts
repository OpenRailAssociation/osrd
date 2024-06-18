import { expect, type Locator, type Page } from '@playwright/test';

import PlaywrightCommonPage from './common-page-model';
import { fillAndCheckInputById } from '../assets/utils';

export default class PlaywrightRollingstockEditorPage extends PlaywrightCommonPage {
  readonly getNewRollingstockButton: Locator;

  readonly getSubmitRollingstockButton: Locator;

  readonly getRollingstockDetailsButton: Locator;

  readonly getSpeedEffortCurvesButton: Locator;

  readonly getRollingStockSpreadsheet: Locator;

  readonly getRollingStockSearchInput: Locator;

  readonly getRollingStockEditorList: Locator;

  readonly getRollingStockEditorButtons: Locator;

  readonly getPowerRestrictionSelector: Locator;

  readonly getElectricalProfileSelector: Locator;

  readonly getLoadingGauge: Locator;

  readonly getTractionModeSelector: Locator;

  readonly getConfirmModalButtonYes: Locator;

  readonly addPowerRestrictionButton: Locator;

  readonly getPowerRestrictionModalBody: Locator;

  readonly getSelectedElectricalProfileButton: Locator;

  readonly deleteSelectedElectricalProfileButton: Locator;

  readonly getDuplicateRollingStockButton: Locator;

  constructor(page: Page) {
    super(page);
    this.getNewRollingstockButton = page.getByTestId('new-rollingstock-button');
    this.getSubmitRollingstockButton = page.getByTestId('submit-rollingstock-button');
    this.getRollingstockDetailsButton = page.getByTestId('tab-rollingstock-details');
    this.getSpeedEffortCurvesButton = page.getByTestId('tab-rollingstock-curves');
    this.getRollingStockSpreadsheet = page.locator('.dsg-container');
    this.getRollingStockSearchInput = page.locator('#searchfilter');
    this.getRollingStockEditorList = page.getByTestId('rollingstock-editor-list');
    this.getRollingStockEditorButtons = page.locator('.rollingstock-editor-buttons');
    this.getPowerRestrictionSelector = page.getByTestId('power-restriction-selector');
    this.getElectricalProfileSelector = page.getByTestId('electrical-profile-selector');
    this.getLoadingGauge = page.locator('#loadingGauge');
    this.getTractionModeSelector = page.getByTestId('traction-mode-selector');
    this.getConfirmModalButtonYes = page.getByTestId('confirm-modal-button-yes');
    this.addPowerRestrictionButton = this.getPowerRestrictionSelector.getByRole('button').nth(1);
    this.getPowerRestrictionModalBody = page.locator('#modal-body');
    this.getSelectedElectricalProfileButton = this.getElectricalProfileSelector.getByRole('button');
    this.deleteSelectedElectricalProfileButton = this.getSelectedElectricalProfileButton.getByRole(
      'button',
      { name: 'Delete item', exact: true }
    );
    this.getDuplicateRollingStockButton = this.getRollingStockEditorButtons
      .locator('button')
      .nth(1);
  }

  // Navigate to the Rolling Stock Editor Page
  async navigateToPage() {
    await this.page.goto('/rolling-stock-editor/');
    await this.removeViteOverlay();
  }

  // Click the New Rolling Stock Button
  async clickOnNewRollingstockButton() {
    await this.getNewRollingstockButton.click();
  }

  // Search for a rolling stock
  async searchRollingStock(rollingStockName: string) {
    await this.getRollingStockSearchInput.fill(rollingStockName);
  }

  // Clear the search for a rolling stock
  async clearSearchRollingStock() {
    await this.getRollingStockSearchInput.clear();
  }

  // Select a rolling stock from the list
  async selectRollingStock(rollingStockName: string) {
    const rollingStockCard = this.page.getByTestId(`rollingstock-${rollingStockName}`);
    await rollingStockCard.click();
  }

  // Edit a rolling stock
  async editRollingStock(rollingStockName: string) {
    await this.selectRollingStock(rollingStockName);
    await this.getRollingStockEditorButtons.first().click();
  }

  // Click the Submit Rolling Stock Button
  async clickOnSubmitRollingstockButton() {
    await this.getSubmitRollingstockButton.click();
  }

  // Click the Rolling Stock Details Button
  async clickOnRollingstockDetailsButton() {
    await this.getRollingstockDetailsButton.click();
  }

  // Click the Speed Effort Curves Button
  async clickOnSpeedEffortCurvesButton() {
    await this.getSpeedEffortCurvesButton.click();
  }

  // Get Velocity cell by row number
  getVelocityCellByRow(row: number) {
    return this.getRollingStockSpreadsheet.locator('.dsg-row').nth(row).locator('.dsg-cell').nth(1);
  }

  // Get Velocity cell value by row number
  async getVelocityCellByRowValue(row: number) {
    return this.getRollingStockSpreadsheet
      .locator('.dsg-row')
      .nth(row)
      .locator('.dsg-cell')
      .nth(1) // Assuming the second cell contains the velocity value
      .locator('input')
      .inputValue();
  }

  // Get Effort cell by row number
  getEffortCellByRow(row: number) {
    return this.getRollingStockSpreadsheet.locator('.dsg-row').nth(row).locator('.dsg-cell').last();
  }

  // Get Effort cell value by row number
  // Note: This method assumes there are at least three cells per row.
  // If the structure changes, update the .nth() index accordingly.
  async getEffortCellByRowValue(row: number) {
    return this.getRollingStockSpreadsheet
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
    await this.getLoadingGauge.selectOption(value);
    expect(await this.getLoadingGauge.inputValue()).toBe(value);
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
      await this.getTractionModeSelector.getByRole('button').click();
      await this.getTractionModeSelector
        .getByRole('button', { name: electricalProfilesValue, exact: true })
        .click();
      await expect(this.getTractionModeSelector.getByTitle(electricalProfilesValue)).toBeVisible();
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
      await this.getPowerRestrictionModalBody
        .getByTitle(powerRestrictionValue, { exact: true })
        .click();
      await expect(
        this.getPowerRestrictionSelector.getByTitle(powerRestrictionValue.replace(/\s/g, ''))
      ).toBeVisible();
    }
    if (toBeUpdated) {
      await this.getPowerRestrictionSelector
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
      await this.getPowerRestrictionSelector
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
    await this.getSelectedElectricalProfileButton.getByTitle(electricalProfileValue).hover();
    await this.deleteSelectedElectricalProfileButton.click();
    await this.getConfirmModalButtonYes.click();
    await expect(
      this.getSelectedElectricalProfileButton.getByTitle(electricalProfileValue)
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
    await this.getConfirmModalButtonYes.click();
  }

  // Duplicate rolling stock creation
  async duplicateRollingStock() {
    await this.getDuplicateRollingStockButton.click();
  }
}
