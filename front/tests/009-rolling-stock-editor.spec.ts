import { expect } from '@playwright/test';

import {
  dualModeRollingStockName,
  electricRollingStockName,
} from './assets/constants/project-const';
import test from './logging-fixture';
import RollingstockEditorPage from './pages/rolling-stock/rolling-stock-editor-page';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import readJsonFile from './utils/file-utils';
import { generateUniqueName, verifyAndCheckInputById, fillAndCheckInputById } from './utils/index';
import { deleteRollingStocks } from './utils/teardown-utils';
import type { RollingStockDetails } from './utils/types';

test.describe('Rollingstock editor page tests', () => {
  let rollingStockEditorPage: RollingstockEditorPage;
  let rollingStockSelector: RollingStockSelector;

  let uniqueRollingStockName: string;
  let uniqueUpdatedRollingStockName: string;
  let uniqueDeletedRollingStockName: string;

  const rollingstockDetails: RollingStockDetails = readJsonFile(
    './tests/assets/rolling-stock/rolling-stock-details.json'
  );

  test.beforeEach(
    'Generate unique names and ensure all existing RS are deleted',
    async ({ page }) => {
      [rollingStockEditorPage, rollingStockSelector] = [
        new RollingstockEditorPage(page),
        new RollingStockSelector(page),
      ];

      uniqueRollingStockName = generateUniqueName('RSN');
      uniqueUpdatedRollingStockName = generateUniqueName('U_RSN');
      uniqueDeletedRollingStockName = generateUniqueName('D_RSN');

      await deleteRollingStocks([
        uniqueRollingStockName,
        uniqueUpdatedRollingStockName,
        uniqueDeletedRollingStockName,
      ]);

      // Navigate to the rolling stock editor page
      await rollingStockEditorPage.navigateToPage();
    }
  );

  /** *************** Test 1 **************** */
  test('Create a new rolling stock', async ({ page }) => {
    // Start the rolling stock creation process
    await rollingStockEditorPage.clickOnNewRollingstockButton();

    // Fill in the rolling stock details with a unique name
    for (const input of rollingstockDetails.inputs) {
      const value = input.id === 'name' ? uniqueRollingStockName : input.value;
      await fillAndCheckInputById(page, input.id, value, input.isNumeric);
    }
    await rollingStockEditorPage.selectLoadingGauge('GA'); // Select loading gauge

    // Select a primary category and other categories, checking each time the state of selector and checkboxes are correct
    await rollingStockEditorPage.selectPrimaryCategory('WORK_TRAIN');
    await rollingStockEditorPage.selectPrimaryCategory('NIGHT_TRAIN');
    await rollingStockEditorPage.uncheckCategoryCheckbox('WORK_TRAIN');
    await rollingStockEditorPage.selectPrimaryCategory('WORK_TRAIN');
    await rollingStockEditorPage.selectPrimaryCategory('NIGHT_TRAIN');
    await rollingStockEditorPage.checkCategoryCheckbox('FREIGHT_TRAIN');
    await rollingStockEditorPage.checkCategoryCheckbox('FAST_FREIGHT_TRAIN');
    await rollingStockEditorPage.uncheckCategoryCheckbox('FAST_FREIGHT_TRAIN');

    // Submit and handle potential warnings
    await rollingStockEditorPage.clickOnSubmitRollingstockButton();
    await expect(rollingStockEditorPage.toastContainer).toBeVisible();

    // Fill in speed effort curves for Not Specified and C1 categories
    await rollingStockEditorPage.fillSpeedEffortCurves(
      rollingstockDetails.speedEffortData,
      false,
      '',
      '1500V'
    );
    await rollingStockEditorPage.fillSpeedEffortCurves(
      rollingstockDetails.speedEffortDataC1,
      true,
      'C1 ',
      '1500V'
    );

    // Fill additional rolling stock details
    await rollingStockEditorPage.fillAdditionalDetails(rollingstockDetails.additionalDetails);

    // Submit and confirm rolling stock creation
    await rollingStockEditorPage.submitRollingStock();
    expect(
      rollingStockEditorPage.page.getByTestId(`rollingstock-${uniqueRollingStockName}`)
    ).toBeDefined();

    // Verify rolling stock details
    await rollingStockEditorPage.searchRollingStock(uniqueRollingStockName);
    await rollingStockEditorPage.verifyRollingStockDetailsTable(rollingstockDetails.expectedValues);
    await rollingStockEditorPage.editRollingStock(uniqueRollingStockName);
    for (const input of rollingstockDetails.inputs) {
      const value = input.id === 'name' ? uniqueRollingStockName : input.value;
      await verifyAndCheckInputById(page, input.id, value, input.isNumeric);
    }

    // Verify speed effort curves
    await rollingStockEditorPage.clickOnSpeedEffortCurvesButton();
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
    await deleteRollingStocks([uniqueRollingStockName]);
  });

  /** *************** Test 2 **************** */
  test('Duplicate and modify a rolling stock', async ({ page }) => {
    // Select the existing electric rolling stock and duplicate it
    await rollingStockEditorPage.selectRollingStock(electricRollingStockName);
    await rollingStockEditorPage.duplicateRollingStock();

    // Update rolling stock details with a unique name
    for (const input of rollingstockDetails.updatedInputs) {
      const value = input.id === 'name' ? uniqueUpdatedRollingStockName : input.value;
      await fillAndCheckInputById(page, input.id, value, input.isNumeric);
    }

    // Select new categories
    await rollingStockEditorPage.selectPrimaryCategory('WORK_TRAIN');
    await rollingStockEditorPage.checkCategoryCheckbox('HIGH_SPEED_TRAIN');
    await rollingStockEditorPage.uncheckCategoryCheckbox('FREIGHT_TRAIN');

    // Modify and verify speed effort curves
    await rollingStockEditorPage.clickOnSpeedEffortCurvesButton();
    await rollingStockEditorPage.deleteElectricalProfile('25000V');
    await rollingStockEditorPage.fillSpeedEffortData(
      rollingstockDetails.speedEffortDataUpdated,
      true,
      'C1',
      true
    );

    // Submit and verify modification
    await rollingStockEditorPage.submitRollingStock();
    await rollingStockEditorPage.searchRollingStock(uniqueUpdatedRollingStockName);
    await rollingStockEditorPage.verifyRollingStockDetailsTable(
      rollingstockDetails.updatedExpectedValues
    );
    await rollingStockEditorPage.editRollingStock(uniqueUpdatedRollingStockName);
    await deleteRollingStocks([uniqueUpdatedRollingStockName]);
  });

  /** *************** Test 3 **************** */
  test('Duplicate and delete a rolling stock', async ({ page }) => {
    // Duplicate and change the name of the rolling stock
    await rollingStockEditorPage.selectRollingStock(electricRollingStockName);
    await rollingStockEditorPage.duplicateRollingStock();
    await fillAndCheckInputById(page, 'name', uniqueDeletedRollingStockName);
    await rollingStockEditorPage.submitRollingStock();

    // Delete the duplicated rolling stock
    await rollingStockEditorPage.deleteRollingStock(uniqueDeletedRollingStockName);
    await expect(
      rollingStockEditorPage.page.getByTestId(uniqueDeletedRollingStockName)
    ).toBeHidden();

    // Search for the deleted rolling stock
    await rollingStockEditorPage.searchRollingStock(uniqueDeletedRollingStockName);

    // Verify that the count of rolling stock is 0 (No results Found)
    await expect(rollingStockSelector.noRollingStockResult).toBeVisible();
    expect(await rollingStockSelector.getRollingStockSearchNumber()).toEqual(0);
  });

  /** *************** Test 4 **************** */
  test('Filtering rolling stocks', async () => {
    // Get the initial rolling stock count
    const initialRollingStockFoundNumber = await rollingStockSelector.getRollingStockSearchNumber();

    // Filter electric rolling stocks and verify count
    await rollingStockSelector.setElectricRollingStockFilter();
    expect(await rollingStockSelector.electricRollingStockIcons.count()).toEqual(
      await rollingStockSelector.getRollingStockSearchNumber()
    );
    // Clear electric filter
    await rollingStockSelector.setElectricRollingStockFilter();

    // Filter thermal rolling stocks and verify count
    await rollingStockSelector.setThermalRollingStockFilter();
    expect(await rollingStockSelector.thermalRollingStockIcons.count()).toEqual(
      await rollingStockSelector.getRollingStockSearchNumber()
    );

    // Filter both electric and thermal rolling stocks (dual-mode) and verify count
    await rollingStockSelector.setElectricRollingStockFilter();
    expect(await rollingStockSelector.dualModeRollingStockIcons.count()).toEqual(
      await rollingStockSelector.getRollingStockSearchNumber()
    );

    // Clear filters and verify the count returns to the initial number
    await rollingStockSelector.setElectricRollingStockFilter();
    await rollingStockSelector.setThermalRollingStockFilter();
    expect(await rollingStockSelector.rollingStockList.count()).toEqual(
      initialRollingStockFoundNumber
    );
  });

  /** *************** Test 5 **************** */
  test('Search for a rolling stock', async () => {
    const initialRollingStockFoundNumber = await rollingStockSelector.getRollingStockSearchNumber();

    // Search for a specific rolling stock
    await rollingStockEditorPage.searchRollingStock(dualModeRollingStockName);
    expect(
      rollingStockEditorPage.page.getByTestId(`rollingstock-${dualModeRollingStockName}`)
    ).toBeDefined();

    // Verify the presence of thermal and electric icons
    await expect(rollingStockSelector.thermalRollingStockFirstIcon).toBeVisible();
    await expect(rollingStockSelector.electricRollingStockFirstIcon).toBeVisible();

    // Clear the search and verify the count returns to the initial number
    await rollingStockEditorPage.clearSearchRollingStock();
    expect(await rollingStockSelector.rollingStockList.count()).toEqual(
      initialRollingStockFoundNumber
    );

    // Search for a non-existent rolling stock and verify no results
    await rollingStockEditorPage.searchRollingStock(`${dualModeRollingStockName}-no-results`);
    await expect(rollingStockSelector.noRollingStockResult).toBeVisible();
    expect(await rollingStockSelector.getRollingStockSearchNumber()).toEqual(0);
  });
});
