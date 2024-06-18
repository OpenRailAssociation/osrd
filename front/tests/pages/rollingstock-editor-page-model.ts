import { expect, type Locator, type Page } from '@playwright/test';
import PlaywrightCommonPage from './common-page-model';
import { deleteApiRequest } from '../assets/utils';

export class PlaywrightRollingstockEditorPage extends PlaywrightCommonPage {
  readonly getNewRollingstockButton: Locator;
  readonly getSubmitRollingstockButton: Locator;
  readonly getRollingstockDetailsButton: Locator;
  readonly getSpeedEffortCurvesButton: Locator;
  readonly getRollingStockSpreadsheet: Locator;
  readonly getRollingStockSearchInput: Locator;
  readonly getRollingStockEditorList: Locator;

  constructor(page: Page) {
    super(page);
    this.getNewRollingstockButton = page.getByTestId('new-rollingstock-button');
    this.getSubmitRollingstockButton = page.getByTestId('submit-rollingstock-button');
    this.getRollingstockDetailsButton = page.getByTestId('tab-rollingstock-details');
    this.getSpeedEffortCurvesButton = page.getByTestId('tab-rollingstock-curves');
    this.getRollingStockSpreadsheet = page.locator('.dsg-container');
    this.getRollingStockSearchInput = page.locator('#searchfilter');
    this.getRollingStockEditorList = page.getByTestId('rollingstock-editor-list');
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
    await this.page.locator('.rollingstock-editor-buttons button').first().click();
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

  // Get Rolling Stock input by ID
  getRollingStockInputById(id: string) {
    return this.page.locator(`#${id}`);
  }

  // Get Rolling Stock input by Test ID
  getRollingStockInputByTestId(testId: string) {
    return this.page.getByTestId(testId);
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
      .nth(1)
      .locator('input')
      .inputValue();
  }

  // Get Effort cell by row number
  getEffortCellByRow(row: number) {
    return this.getRollingStockSpreadsheet.locator('.dsg-row').nth(row).locator('.dsg-cell').last();
  }

  // Get Effort cell value by row number
  async getEffortCellByRowValue(row: number) {
    return this.getRollingStockSpreadsheet
      .locator('.dsg-row')
      .nth(row)
      .locator('.dsg-cell')
      .last()
      .locator('input')
      .inputValue();
  }

  // Set spreadsheet cell value
  async setSpreadsheetCell(value: string, cell: Locator) {
    const inputStrings = value.toString().split('');
    await cell.dblclick();
    await this.page.keyboard.press('Backspace');
    for (const digit of inputStrings) {
      await this.page.keyboard.press(digit);
    }
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

  // Fill and check input by ID
  async fillAndCheckInputById(inputId: string, value: string | number, isTestId = false) {
    const input = isTestId
      ? this.getRollingStockInputByTestId(inputId)
      : this.getRollingStockInputById(inputId);

    await input.click();
    await input.fill(`${value}`);
    expect(await input.inputValue()).toBe(`${value}`);
  }

  // Verify input by ID
  async verifyAndCheckInputById(inputId: string, expectedValue: string | number, isTestId = false) {
    const input = isTestId
      ? this.getRollingStockInputByTestId(inputId)
      : this.getRollingStockInputById(inputId);

    expect(await input.inputValue()).toBe(`${expectedValue}`);
  }

  // Select gauge value
  async selectLoadingGauge(value: string) {
    const loadingGauge = this.getRollingStockInputById('loadingGauge');
    await loadingGauge.selectOption(value);
    expect(await loadingGauge.inputValue()).toBe(value);
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
      const tractionModesSelector = this.getRollingStockInputByTestId('traction-mode-selector');
      await tractionModesSelector.getByRole('button').click();
      await tractionModesSelector
        .getByRole('button', { name: electricalProfilesValue, exact: true })
        .click();
      await expect(tractionModesSelector.getByTitle(electricalProfilesValue)).toBeVisible();
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
    const powerRestrictionSelector = this.getRollingStockInputByTestId(
      'power-restriction-selector'
    );

    if (isPowerRestrictionSpecified && !toBeUpdated) {
      await powerRestrictionSelector.getByRole('button').nth(1).click();
      const modal = this.getRollingStockInputById('modal-body');
      await modal.getByTitle(powerRestrictionValue, { exact: true }).click();
      await expect(
        powerRestrictionSelector.getByTitle(powerRestrictionValue.replace(/\s/g, ''))
      ).toBeVisible();
    }
    if (toBeUpdated) {
      await powerRestrictionSelector.getByTitle(powerRestrictionValue, { exact: true }).click();
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
      const powerRestrictionSelector = this.getRollingStockInputByTestId(
        'power-restriction-selector'
      );
      await powerRestrictionSelector.getByRole('button', { name: powerRestrictionValue }).click();
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
    const electricalProfileSelector = this.getRollingStockInputByTestId(
      'electrical-profile-selector'
    );
    const selectedElectricalProfile = electricalProfileSelector
      .getByRole('button')
      .getByTitle(electricalProfileValue);
    await selectedElectricalProfile.hover();
    await electricalProfileSelector
      .getByRole('button')
      .getByRole('button', { name: 'Delete item', exact: true })
      .click();
    const deleteConfirmationModal = this.getRollingStockInputById('modal-content');
    await deleteConfirmationModal.getByText('Confirm').click();
    await expect(selectedElectricalProfile.getByTitle(electricalProfileValue)).toBeHidden();
  }

  // Fill additional details
  async fillAdditionalDetails(details: {
    electricalPowerStartupTime: number;
    raisePantographTime: number;
  }) {
    await this.clickOnRollingstockDetailsButton();
    await this.fillAndCheckInputById(
      'electricalPowerStartupTime',
      details.electricalPowerStartupTime
    );
    await this.fillAndCheckInputById('raisePantographTime', details.raisePantographTime);
  }

  // Submit rolling stock creation
  async submitRollingStock() {
    await this.clickOnSubmitRollingstockButton();
  }

  // Submit and confirm rolling stock creation
  async confirmRollingStockCreation() {
    await this.submitRollingStock();
    await this.page.getByText('Oui', { exact: true }).click();
  }

  // Duplicate rolling stock creation
  async duplicateRollingStock() {
    const duplicateRollingStockButton = this.page
      .locator('.rollingstock-editor-buttons')
      .locator('button')
      .nth(1);
    await duplicateRollingStockButton.click();
  }

  // Delete rolling stock by ID API
  async deleteRollingStock(id: number) {
    await deleteApiRequest(`/api/rolling_stock/${id}/`);
  }
}
