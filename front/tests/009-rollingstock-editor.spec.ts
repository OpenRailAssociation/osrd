/* eslint-disable no-restricted-syntax, no-await-in-loop */
import path from 'path';

import { test, expect } from '@playwright/test';

import RollingstockEditorPage from './pages/rollingstock-editor-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page';
import {
  generateUniqueName,
  verifyAndCheckInputById,
  fillAndCheckInputById,
  readJsonFile,
} from './utils/index';
import { findAndDeleteRollingStocks } from './utils/rollingStock-utils';

// Correct path to load rolling stock details from JSON
const rollingstockDetailsPath = path.resolve(
  __dirname,
  '../tests/assets/rollingStock/rollingstockDetails.json'
);

const rollingstockDetails = readJsonFile(rollingstockDetailsPath);
const dualModeRollingStockName = 'dual-mode_rollingstock_test_e2e';
const electricRollingStockName = 'rollingstock_1500_25000_test_e2e';

test.describe('Rollingstock editor page', () => {
  let uniqueRollingStockName: string;
  let uniqueUpdatedRollingStockName: string;
  let uniqueDeletedRollingStockName: string;

  test.beforeEach(async () => {
    uniqueRollingStockName = await generateUniqueName('RSN');
    uniqueUpdatedRollingStockName = await generateUniqueName('U_RSN');
    uniqueDeletedRollingStockName = await generateUniqueName('D_RSN');

    // Check and delete the specified rolling stocks if they exist
    await findAndDeleteRollingStocks([
      uniqueRollingStockName,
      uniqueUpdatedRollingStockName,
      uniqueDeletedRollingStockName,
    ]);
  });

  test.afterEach(async () => {
    // Clean up by deleting the created or updated rolling stock
    await findAndDeleteRollingStocks([
      uniqueRollingStockName,
      uniqueUpdatedRollingStockName,
      uniqueDeletedRollingStockName,
    ]);
  });

  test('should correctly create a new rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new RollingstockEditorPage(page);
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
    const rollingStockEditorPage = new RollingstockEditorPage(page);

    await rollingStockEditorPage.navigateToPage();

    // Select the rolling stock from global-setup
    await rollingStockEditorPage.selectRollingStock(electricRollingStockName);

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
    await rollingStockEditorPage.searchRollingStock(electricRollingStockName);
    expect(rollingStockEditorPage.page.getByTestId(electricRollingStockName)).toBeDefined();
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
    const rollingStockEditorPage = new RollingstockEditorPage(page);

    await rollingStockEditorPage.navigateToPage();

    // Select the rolling stock from global-setup
    await rollingStockEditorPage.selectRollingStock(electricRollingStockName);

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
  test('should correctly filter a rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new RollingstockEditorPage(page);
    const rollingStockSelectorPage = new RollingStockSelectorPage(page);
    // Navigate to rolling stock editor page
    await rollingStockEditorPage.navigateToPage();

    // Extract and check the initial count of rolling stock
    const initialRollingStockFoundNumber =
      await rollingStockSelectorPage.getRollingStockSearchNumber();

    // Perform a filtering action for electric rolling stock
    await rollingStockSelectorPage.electricRollingStockFilter();

    // Verify that filtering reduces the count and all the RS have electic icons
    expect(await rollingStockSelectorPage.getElectricRollingStockIcons.count()).toEqual(
      await rollingStockSelectorPage.getRollingStockSearchNumber()
    );

    // Clear electric filter
    await rollingStockSelectorPage.electricRollingStockFilter();

    // Perform a filtering action for thermal rolling stock
    await rollingStockSelectorPage.thermalRollingStockFilter();

    // Verify that filtering reduces the count and all the RS have thermal icons
    expect(await rollingStockSelectorPage.getThermalRollingStockIcons.count()).toEqual(
      await rollingStockSelectorPage.getRollingStockSearchNumber()
    );

    // Perform a filtering action for dual-mode rolling stock
    await rollingStockSelectorPage.electricRollingStockFilter();

    // Verify that filtering reduces the count and all the RS have thermal and electric icons
    expect(await rollingStockSelectorPage.getDualModeRollingStockIcons.count()).toEqual(
      await rollingStockSelectorPage.getRollingStockSearchNumber()
    );

    // Clear filters
    await rollingStockSelectorPage.electricRollingStockFilter();
    await rollingStockSelectorPage.thermalRollingStockFilter();

    // Verify that the count of rolling stock is back to the initial number
    expect(await rollingStockSelectorPage.getRollingStockList.count()).toEqual(
      initialRollingStockFoundNumber
    );
  });

  test('should correctly search for a rolling stock', async ({ page }) => {
    const rollingStockEditorPage = new RollingstockEditorPage(page);
    const rollingStockSelectorPage = new RollingStockSelectorPage(page);

    // Navigate to rolling stock editor page
    await rollingStockEditorPage.navigateToPage();

    // Extract and check the initial count of rolling stock
    const initialRollingStockFoundNumber =
      await rollingStockSelectorPage.getRollingStockSearchNumber();

    // Search for the specific rolling stock
    await rollingStockEditorPage.searchRollingStock(dualModeRollingStockName);
    expect(
      rollingStockEditorPage.page.getByTestId(`rollingstock-${dualModeRollingStockName}`)
    ).toBeDefined();

    // Verify that the first rolling stock has the thermal and electric icon
    await expect(rollingStockSelectorPage.getThermalRollingStockFirstIcon).toBeVisible();
    await expect(rollingStockSelectorPage.getElectricRollingStockFirstIcon).toBeVisible();

    // Clear the search
    await rollingStockEditorPage.clearSearchRollingStock();

    // Verify that the count of rolling stock is back to the initial number
    expect(await rollingStockSelectorPage.getRollingStockList.count()).toEqual(
      initialRollingStockFoundNumber
    );
    // Search for a non existing rolling stock
    await rollingStockEditorPage.searchRollingStock(`${dualModeRollingStockName}-no-results`);

    // Verify that the count of rolling stock is 0 (No results Found)
    await expect(rollingStockSelectorPage.getNoRollingStockResult).toBeVisible();
    expect(await rollingStockSelectorPage.getRollingStockSearchNumber()).toEqual(0);
  });
});
