import fs from 'fs';
import path from 'path';

import { test, expect } from '@playwright/test';

import {
  findAndDeleteRollingStock,
  generateUniqueName,
  verifyAndCheckInputById,
  fillAndCheckInputById,
} from './assets/utils';
import PlaywrightRollingstockEditorPage from './pages/rollingstock-editor-page-model';

// Correct path to load rolling stock details from JSON
const rollingstockDetailsPath = path.resolve(
  __dirname,
  '../tests/assets/rollingStock/rollingstockDetails.json'
);
const rollingstockDetails = JSON.parse(fs.readFileSync(rollingstockDetailsPath, 'utf-8'));

test.describe('Rollingstock editor page', () => {
  let uniqueRollingStockName: string;
  let uniqueUpdatedRollingStockName: string;
  let uniqueDeletedRollingStockName: string;

  test.beforeEach(async () => {
    uniqueRollingStockName = await generateUniqueName('RSN');
    uniqueUpdatedRollingStockName = await generateUniqueName('U_RSN');
    uniqueDeletedRollingStockName = await generateUniqueName('D_RSN');

    // Check and delete the specified rolling stocks if they exist
    await findAndDeleteRollingStock(uniqueRollingStockName);
    await findAndDeleteRollingStock(uniqueUpdatedRollingStockName);
    await findAndDeleteRollingStock(uniqueDeletedRollingStockName);
  });

  test.afterEach(async () => {
    // Clean up by deleting the created or updated rolling stock
    await findAndDeleteRollingStock(uniqueRollingStockName);
    await findAndDeleteRollingStock(uniqueUpdatedRollingStockName);
    await findAndDeleteRollingStock(uniqueDeletedRollingStockName);
  });

  test('should correctly create a new rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new PlaywrightRollingstockEditorPage(page);
    // Navigate to the page
    await rollingStockEditorPage.navigateToPage();

    // Create a new rolling stock
    await rollingStockEditorPage.clickOnNewRollingstockButton();

    // Fill in the rolling stock details with unique name
    for (const input of rollingstockDetails.inputs) {
      const value = input.id === 'name' ? uniqueRollingStockName : input.value;
      await fillAndCheckInputById(page, input.id, value, input.isNumeric);
    }
    // Select loading gauge
    await rollingStockEditorPage.selectLoadingGauge('GA');

    // Submit and handle incomplete form warning
    await rollingStockEditorPage.clickOnSubmitRollingstockButton();
    await expect(rollingStockEditorPage.getToastSNCF).toBeVisible();

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
    await rollingStockEditorPage.submitRollingStock();

    // Confirm the creation of the rolling stock
    expect(
      rollingStockEditorPage.page.getByTestId(`rollingstock-${uniqueRollingStockName}`)
    ).toBeDefined();

    // Get to details page of the new rolling stock
    await rollingStockEditorPage.searchRollingStock(uniqueRollingStockName);
    await rollingStockEditorPage.editRollingStock(uniqueRollingStockName);

    // Verify the rolling stock details
    for (const input of rollingstockDetails.inputs) {
      const value = input.id === 'name' ? uniqueRollingStockName : input.value;
      await verifyAndCheckInputById(page, input.id, value, input.isNumeric);
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
  });

  test('should correctly duplicate and modify a rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new PlaywrightRollingstockEditorPage(page);
    const addedRollingStockName = 'rollingstock_1500_25000_test_e2e';

    await rollingStockEditorPage.navigateToPage();

    // Select the rolling stock from global-setup
    await rollingStockEditorPage.selectRollingStock(addedRollingStockName);

    // Duplicate rolling stock
    await rollingStockEditorPage.duplicateRollingStock();

    // Update the rolling stock details and curves with unique name
    for (const input of rollingstockDetails.updatedInputs) {
      const value = input.id === 'name' ? uniqueUpdatedRollingStockName : input.value;
      await fillAndCheckInputById(page, input.id, value, input.isNumeric);
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
    await rollingStockEditorPage.submitRollingStock();

    // Confirm the presence of the original RS
    await rollingStockEditorPage.searchRollingStock(addedRollingStockName);
    expect(rollingStockEditorPage.page.getByTestId(addedRollingStockName)).toBeDefined();
    await rollingStockEditorPage.clearSearchRollingStock();

    // Get to details page of the new rolling stock
    await rollingStockEditorPage.searchRollingStock(uniqueUpdatedRollingStockName);
    await rollingStockEditorPage.editRollingStock(uniqueUpdatedRollingStockName);

    // Verify the rolling stock details
    for (const input of rollingstockDetails.updatedInputs) {
      const value = input.id === 'name' ? uniqueUpdatedRollingStockName : input.value;
      await verifyAndCheckInputById(page, input.id, value, input.isNumeric);
    }
    await rollingStockEditorPage.clickOnSpeedEffortCurvesButton();

    // Verify speed effort curves
    await rollingStockEditorPage.verifySpeedEffortCurves(
      rollingstockDetails.speedEffortDataUpdated,
      true,
      'C1'
    );
  });
  test('should correctly duplicate and delete a rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new PlaywrightRollingstockEditorPage(page);
    const addedRollingStockName = 'rollingstock_1500_25000_test_e2e';

    await rollingStockEditorPage.navigateToPage();

    // Select the rolling stock from global-setup
    await rollingStockEditorPage.selectRollingStock(addedRollingStockName);

    // Duplicate and change the rolling stock name
    await rollingStockEditorPage.duplicateRollingStock();
    await fillAndCheckInputById(page, 'name', uniqueDeletedRollingStockName);

    // Confirm the modification of RS name
    await rollingStockEditorPage.submitRollingStock();

    // Delete the duplicated rolling stock
    await rollingStockEditorPage.deleteRollingStock(uniqueDeletedRollingStockName);

    // Confirm the RS is deleted
    await expect(
      rollingStockEditorPage.page.getByTestId(uniqueDeletedRollingStockName)
    ).toBeHidden();
  });
});
