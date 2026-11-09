import { expect, type Locator, type Page } from '@playwright/test';

import type { RollingStock } from 'common/api/osrdEditoastApi';

import { ROLLING_STOCK_EDITOR_URL } from '../../assets/constants/homepage-const';
import { type ExpectedListing, fillAndCheckInputById } from '../../utils';
import { readJsonFile } from '../../utils/file-utils';
import type { FlatTranslations } from '../../utils/types';
import RollingStockSelector from './rolling-stock-selector';

type RollingStockTranslations = FlatTranslations & { categoriesOptions: FlatTranslations };

const frTranslations = readJsonFile<{ rollingStock: RollingStockTranslations }>(
  'public/locales/fr/translation.json'
).rollingStock;

class RollingstockEditorPage extends RollingStockSelector {
  private readonly rollingstockEditorList: Locator;
  private readonly rollingStockCards: Locator;
  private readonly rollingStockCard: (rollingStockName: string) => Locator;
  private readonly categoryCheckbox: (rollingStockCategory: string) => Locator;
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
  private readonly exportRollingStockButton: Locator;
  private readonly importRollingStockButton: Locator;
  private readonly uploadFileDropzone: Locator;
  private readonly uploadFileSubmitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.rollingstockEditorList = page.getByTestId('rollingstock-editor-list');
    this.rollingStockCards = this.rollingstockEditorList.getByTestId(/^rollingstock-/);
    this.rollingStockCard = (rollingStockName) =>
      page.getByTestId(`rollingstock-${rollingStockName}`);
    this.categoryCheckbox = (rollingStockCategory) =>
      page.getByTestId(`category-checkbox-${rollingStockCategory}-checkbox`);
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
    this.exportRollingStockButton = page.getByTestId('rollingstock-export-button');
    this.importRollingStockButton = page.getByTestId('import-rollingstock-button');
    this.uploadFileDropzone = page.getByTestId('upload-file-modal-dropzone');
    this.uploadFileSubmitButton = page.getByTestId('upload-file-modal-download-button');
  }

  async navigateToRollingStockPage() {
    await this.page.goto(ROLLING_STOCK_EDITOR_URL);
    await this.waitForLoaderToDisappear();
  }

  async openRollingStockEditorAndCheckListIsDisplayed() {
    await this.page.goto(ROLLING_STOCK_EDITOR_URL);
    await expect(this.page).toHaveURL(ROLLING_STOCK_EDITOR_URL);
    await expect(this.rollingstockEditorList).toBeVisible();
  }

  async openNewRollingStockForm() {
    await this.newRollingstockButton.click();
  }

  async verifyFirstRollingStockCardVisibility() {
    await expect(this.rollingStockCards.first()).toBeVisible();
  }

  async searchRollingStock(rollingStockName: string, shouldExist = true) {
    await this.searchRollingStockAndCheckResults(rollingStockName, {
      listed: shouldExist ? [rollingStockName] : [],
      notListed: shouldExist ? [] : [rollingStockName],
    });
  }

  async searchRollingStockAndCheckResults(query: string, { listed, notListed }: ExpectedListing) {
    await this.rollingStockSearchInput.fill(query);
    await this.waitForLoaderToDisappear();
    for (const name of listed) {
      await expect(this.rollingStockCard(name)).toBeVisible();
    }
    for (const name of notListed) {
      await expect(this.rollingStockCard(name)).toBeHidden();
    }
  }

  async clearSearchRollingStock() {
    await this.rollingStockSearchInput.clear();
    await this.waitForLoaderToDisappear();
  }

  async selectRollingStock(rollingStockName: string) {
    await this.rollingStockCard(rollingStockName).click();
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
    await expect(this.loadingGauge).toHaveValue(value);
  }

  async selectPrimaryCategory(value: string) {
    await this.primaryCategorySelector.selectOption(value);
    await expect(this.primaryCategorySelector).toHaveValue(value);
    const checkbox = this.categoryCheckbox(value);
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();
  }

  async checkCategoryCheckbox(category: string) {
    const checkbox = this.categoryCheckbox(category);
    await expect(checkbox).not.toBeChecked();
    await checkbox.locator('..').locator('label').click();
    await expect(checkbox).toBeChecked();
  }

  async uncheckCategoryCheckbox(category: string) {
    const checkbox = this.categoryCheckbox(category);
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

  async saveRollingStock() {
    await this.confirmRollingStockCreation();
    await expect(this.submitRollingstockButton).toBeHidden();
  }

  async importRollingStock(rollingStockJson: { name: string }): Promise<RollingStock> {
    await this.importRollingStockButton.click();
    await this.uploadFileDropzone.setInputFiles({
      name: 'rolling-stock.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(rollingStockJson)),
    });
    const creationResponse = this.page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/rolling_stock' &&
        response.request().method() === 'POST'
    );
    await this.uploadFileSubmitButton.click();
    const response = await creationResponse;
    expect(response.ok(), `Failed to import rolling stock "${rollingStockJson.name}"`).toBe(true);
    await expect(this.rollingStockCard(rollingStockJson.name)).toBeVisible();
    return (await response.json()) as RollingStock;
  }

  async duplicateRollingStock() {
    await this.duplicateRollingStockButton.click();
  }

  async deleteRollingStock(rollingStockName: string) {
    await this.selectRollingStock(rollingStockName);
    await this.deleteRollingStockButton.click();
    await this.confirmModalButtonYes.click();
  }

  async expectRollingStockActions({
    canEdit,
    canDuplicate,
    canDelete,
  }: {
    canEdit: boolean;
    canDuplicate: boolean;
    canDelete: boolean;
  }) {
    await expect(this.editRollingStockButton).toBeEnabled({ enabled: canEdit });
    await expect(this.duplicateRollingStockButton).toBeEnabled({ enabled: canDuplicate });
    await expect(this.deleteRollingStockButton).toBeEnabled({ enabled: canDelete });
  }

  async expectFullInformationPanel(visible: boolean) {
    await expect(this.exportRollingStockButton).toBeVisible({ visible });
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

      await expect(valueCell).toHaveText(
        Array.isArray(expectedValue) ? expectedValue.join(', ') : expectedValue.toString()
      );
    }
  }
}
export default RollingstockEditorPage;
