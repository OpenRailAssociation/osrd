import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import type { RollingStock } from 'common/api/osrdEditoastApi';
import { PlaywrightRollingstockEditorPage } from './pages/rollingstock-editor-page-model';

// Correct path to load rolling stock details from JSON

const rollingstockDetailsPath = path.resolve(
  __dirname,
  '../tests/assets/rollingStock/rollingstockDetails.js'
);
const rollingstockDetails = JSON.parse(fs.readFileSync(rollingstockDetailsPath, 'utf-8'));

test.describe('Rollingstock editor page', () => {
  test('should correctly create a new rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new PlaywrightRollingstockEditorPage(page);
    const rollingStockCreatedName = 'Test_name';

    // Navigate to the page
    await rollingStockEditorPage.navigateToPage();

    // Create a new rolling stock
    await rollingStockEditorPage.clickOnNewRollingstockButton();

    // Fill in the rolling stock details
    for (const input of rollingstockDetails.inputs) {
      await rollingStockEditorPage.fillAndCheckInputById(input.id, input.value, input.isNumeric);
    }

    // Select loading gauge
    await rollingStockEditorPage.selectLoadingGauge('GA');

    // Submit and handle incomplete form warning
    await rollingStockEditorPage.submitRollingStock();
    await rollingStockEditorPage.checkToastSNCFTitle(/Formulaire incomplet/);

    // Fill speed effort curves Not Specified
    await rollingStockEditorPage.fillSpeedEffortCurves(
      rollingstockDetails.speedEffortData,
      false,
      '',
      '1500V'
    );

    // Fill speed effort curves C1
    await rollingStockEditorPage.fillSpeedEffortCurves(
      rollingstockDetails.speedEffortDataC1,
      true,
      'C1 ',
      '1500V'
    );

    // Fill additional rolling stock details
    await rollingStockEditorPage.fillAdditionalDetails(rollingstockDetails.additionalDetails);

    // Submit and confirm rolling stock
    await rollingStockEditorPage.confirmRollingStockCreation();

    // Confirm the creation of the rolling stock
    const responsePromise = rollingStockEditorPage.page.waitForResponse((response) =>
      response.url().includes('/api/rolling_stock/')
    );

    expect(
      await rollingStockEditorPage.page.getByTestId(`rollingstock-${rollingStockCreatedName}`)
    ).toBeDefined();

    // Get to details page of the new rollingstock
    await rollingStockEditorPage.searchRollingStock(rollingStockCreatedName);
    await rollingStockEditorPage.editRollingStock(rollingStockCreatedName);

    // Verify the rolling stock details
    for (const input of rollingstockDetails.inputs) {
      await rollingStockEditorPage.verifyAndCheckInputById(input.id, input.value, input.isNumeric);
    }
    await rollingStockEditorPage.clickOnSpeedEffortCurvesButton();

    // Verify speed effort curves
    await rollingStockEditorPage.verifySpeedEffortCurves(
      rollingstockDetails.speedEffortData,
      false,
      'C1'
    );
    await rollingStockEditorPage.verifySpeedEffortCurves(
      rollingstockDetails.speedEffortDataC1,
      true,
      'C1'
    );

    // Delete the rolling stock created
    const response = await responsePromise;
    const responseJSON: RollingStock = await response.json();
    await rollingStockEditorPage.deleteRollingStock(responseJSON.id);
  });

  test('should correctly duplicate and modify a rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new PlaywrightRollingstockEditorPage(page);
    const rollingStockUpdatedName = 'Test_name_updated';
    const rollingStockAddedName = 'rollingstock_1500_25000_test_e2e';
    await rollingStockEditorPage.navigateToPage();

    // Select the rolling stock from global-setup
    await rollingStockEditorPage.selectRollingStock(rollingStockAddedName);

    const responsePromise = rollingStockEditorPage.page.waitForResponse((response) =>
      response.url().includes('/api/rolling_stock/')
    );

    // Duplicate rolling stock
    await rollingStockEditorPage.duplicateRollingStock();

    // Update the rolling stock details and curves
    for (const input of rollingstockDetails.updatedInputs) {
      await rollingStockEditorPage.fillAndCheckInputById(input.id, input.value, input.isNumeric);
    }
    await rollingStockEditorPage.clickOnSpeedEffortCurvesButton();
    await rollingStockEditorPage.deleteElectricalProfile('25000V');
    await rollingStockEditorPage.fillSpeedEffortData(
      rollingstockDetails.speedEffortDataUpdated,
      true,
      'C1',
      true
    );

    // Confirm the modification of RS
    await rollingStockEditorPage.clickOnSubmitRollingstockButton();
    await rollingStockEditorPage.page.getByText('Oui', { exact: true }).click();

    // Confirm the presence of the original RS
    rollingStockEditorPage.searchRollingStock(rollingStockAddedName);
    expect(await rollingStockEditorPage.page.getByTestId(rollingStockAddedName)).toBeVisible;
    await rollingStockEditorPage.clearSearchRollingStock();

    // Get to details page of the new rollingstock
    await rollingStockEditorPage.searchRollingStock(rollingStockUpdatedName);
    await rollingStockEditorPage.editRollingStock(rollingStockUpdatedName);

    // Verify the rolling stock details
    for (const input of rollingstockDetails.updatedInputs) {
      await rollingStockEditorPage.verifyAndCheckInputById(input.id, input.value, input.isNumeric);
    }
    await rollingStockEditorPage.clickOnSpeedEffortCurvesButton();

    // Verify speed effort curves
    await rollingStockEditorPage.verifySpeedEffortCurves(
      rollingstockDetails.speedEffortDataUpdated,
      true,
      'C1'
    );

    // Delete the rolling stock duplicated
    const response = await responsePromise;
    const responseJSON: RollingStock = await response.json();
    await rollingStockEditorPage.deleteRollingStock(responseJSON.id);
  });
});
