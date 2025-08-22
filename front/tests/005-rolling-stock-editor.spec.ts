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

const rollingstockDetails: RollingStockDetails = readJsonFile(
  './tests/assets/rolling-stock/rolling-stock-details.json'
);

test.describe('Rollingstock editor page tests', () => {
  let rollingStockEditorPage: RollingstockEditorPage;
  let rollingStockSelector: RollingStockSelector;

  let uniqueRollingStockName: string;
  let uniqueUpdatedRollingStockName: string;
  let uniqueDeletedRollingStockName: string;

  test.beforeEach(async ({ page }) => {
    [rollingStockEditorPage, rollingStockSelector] = [
      new RollingstockEditorPage(page),
      new RollingStockSelector(page),
    ];

    await test.step('Generate unique names and cleanup any leftovers', async () => {
      uniqueRollingStockName = generateUniqueName('RSN');
      uniqueUpdatedRollingStockName = generateUniqueName('U_RSN');
      uniqueDeletedRollingStockName = generateUniqueName('D_RSN');

      await deleteRollingStocks([
        uniqueRollingStockName,
        uniqueUpdatedRollingStockName,
        uniqueDeletedRollingStockName,
      ]);
    });

    await test.step('Navigate to editor and ensure first card is visible', async () => {
      await rollingStockEditorPage.navigateToRollingStockPage();
      await rollingStockEditorPage.verifyFirstRollingStockCardVisibility();
    });
  });

  /** *************** Test 1 **************** */
  test('Create a new rolling stock', async ({ page }) => {
    await test.step('Open creation form', async () => {
      await rollingStockEditorPage.openNewRollingStockForm();
    });

    await test.step('Fill base details and loading gauge', async () => {
      for (const input of rollingstockDetails.inputs) {
        const value = input.id === 'name' ? uniqueRollingStockName : input.value;
        await fillAndCheckInputById(page, input.id, value, input.isNumeric);
      }
      await rollingStockEditorPage.selectLoadingGauge('GA');
    });

    await test.step('Select categories (primary + other )', async () => {
      await rollingStockEditorPage.selectPrimaryCategory('WORK_TRAIN');
      await rollingStockEditorPage.selectPrimaryCategory('NIGHT_TRAIN');
      await rollingStockEditorPage.uncheckCategoryCheckbox('WORK_TRAIN');
      await rollingStockEditorPage.selectPrimaryCategory('WORK_TRAIN');
      await rollingStockEditorPage.selectPrimaryCategory('NIGHT_TRAIN');
      await rollingStockEditorPage.checkCategoryCheckbox('FREIGHT_TRAIN');
      await rollingStockEditorPage.checkCategoryCheckbox('FAST_FREIGHT_TRAIN');
      await rollingStockEditorPage.uncheckCategoryCheckbox('FAST_FREIGHT_TRAIN');
    });

    await test.step('Submit initial form and handle warnings', async () => {
      await rollingStockEditorPage.submitRollingstock();
      await expect(rollingStockEditorPage.toastContainer).toBeVisible();
    });

    await test.step('Fill speed effort curves (Not specified + C1)', async () => {
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
    });

    await test.step('Fill additional details', async () => {
      await rollingStockEditorPage.fillAdditionalDetails(rollingstockDetails.additionalDetails);
    });

    await test.step('Submit and confirm rolling stock creation', async () => {
      await rollingStockEditorPage.confirmRollingStockCreation();
      expect(
        rollingStockEditorPage.page.getByTestId(`rollingstock-${uniqueRollingStockName}`)
      ).toBeDefined();
    });

    await test.step('Search and verify rolling stock details', async () => {
      await rollingStockEditorPage.searchRollingStock(uniqueRollingStockName);
      await rollingStockEditorPage.verifyRollingStockDetailsTable(
        rollingstockDetails.expectedValues
      );
      await rollingStockEditorPage.editRollingStock(uniqueRollingStockName);
      for (const input of rollingstockDetails.inputs) {
        const value = input.id === 'name' ? uniqueRollingStockName : input.value;
        await verifyAndCheckInputById(page, input.id, value, input.isNumeric);
      }
    });

    await test.step('Verify speed effort curves values', async () => {
      await rollingStockEditorPage.openSpeedEffortCurves();
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

    await test.step('Delete created rolling stock', async () => {
      await deleteRollingStocks([uniqueRollingStockName]);
    });
  });

  /** *************** Test 2 **************** */
  test('Duplicate and modify a rolling stock', async ({ page }) => {
    await test.step('Duplicate existing Electric rolling stock', async () => {
      await rollingStockEditorPage.selectRollingStock(electricRollingStockName);
      await rollingStockEditorPage.duplicateRollingStock();
    });

    await test.step('Update inputs with a unique name', async () => {
      for (const input of rollingstockDetails.updatedInputs) {
        const value = input.id === 'name' ? uniqueUpdatedRollingStockName : input.value;
        await fillAndCheckInputById(page, input.id, value, input.isNumeric);
      }
    });

    await test.step('Select new categories', async () => {
      await rollingStockEditorPage.selectPrimaryCategory('WORK_TRAIN');
      await rollingStockEditorPage.checkCategoryCheckbox('HIGH_SPEED_TRAIN');
      await rollingStockEditorPage.uncheckCategoryCheckbox('FREIGHT_TRAIN');
    });

    await test.step('Modify speed effort curves', async () => {
      await rollingStockEditorPage.openSpeedEffortCurves();
      await rollingStockEditorPage.deleteElectricalProfile('25000V');
      await rollingStockEditorPage.fillSpeedEffortData(
        rollingstockDetails.speedEffortDataUpdated,
        true,
        'C1',
        true
      );
    });

    await test.step('Confirm and verify updated rolling stock', async () => {
      await rollingStockEditorPage.confirmRollingStockCreation();
      await rollingStockEditorPage.searchRollingStock(uniqueUpdatedRollingStockName);
      await rollingStockEditorPage.verifyRollingStockDetailsTable(
        rollingstockDetails.updatedExpectedValues
      );
      await rollingStockEditorPage.editRollingStock(uniqueUpdatedRollingStockName);
    });

    await test.step('Delete duplicated rolling stock', async () => {
      await deleteRollingStocks([uniqueUpdatedRollingStockName]);
    });
  });

  /** *************** Test 3 **************** */
  test('Duplicate and delete a rolling stock', async ({ page }) => {
    await test.step('Duplicate Electric rolling stock and rename', async () => {
      await rollingStockEditorPage.selectRollingStock(electricRollingStockName);
      await rollingStockEditorPage.duplicateRollingStock();
      await fillAndCheckInputById(page, 'name', uniqueDeletedRollingStockName);
      await rollingStockEditorPage.confirmRollingStockCreation();
    });

    await test.step('Delete duplicated rolling stock and assert hidden', async () => {
      await rollingStockEditorPage.deleteRollingStock(uniqueDeletedRollingStockName);
      await expect(
        rollingStockEditorPage.page.getByTestId(uniqueDeletedRollingStockName)
      ).toBeHidden();
    });

    await test.step('Search deleted rolling stock → expect no results', async () => {
      await rollingStockEditorPage.searchRollingStock(uniqueDeletedRollingStockName);
      await expect(rollingStockSelector.noRollingStockResult).toBeVisible();
      expect(await rollingStockSelector.getRollingStockSearchNumber()).toEqual(0);
    });
  });

  /** *************** Test 4 **************** */
  test('Filtering rolling stocks', async () => {
    const initialRollingStockFoundNumber = await rollingStockSelector.getRollingStockSearchNumber();

    await test.step('Toggle Electric filter and verify count', async () => {
      await rollingStockSelector.toggleElectricRollingStockFilter();
      expect(await rollingStockSelector.electricRollingStockIcons.count()).toEqual(
        await rollingStockSelector.getRollingStockSearchNumber()
      );
    });

    await test.step('Clear Electric filter and verify initial count', async () => {
      await rollingStockSelector.toggleElectricRollingStockFilter();
      expect(await rollingStockSelector.rollingStockList.count()).toBeGreaterThanOrEqual(
        initialRollingStockFoundNumber
      );
    });

    await test.step('Toggle Thermal filter and verify count', async () => {
      await rollingStockSelector.toggleThermalRollingStockFilter();
      expect(await rollingStockSelector.thermalRollingStockIcons.count()).toEqual(
        await rollingStockSelector.getRollingStockSearchNumber()
      );
    });

    await test.step('Toggle Electric with Thermal on (dual-mode) and verify count', async () => {
      await rollingStockSelector.toggleElectricRollingStockFilter();
      expect(await rollingStockSelector.dualModeRollingStockIcons.count()).toEqual(
        await rollingStockSelector.getRollingStockSearchNumber()
      );
    });

    await test.step('Clear both filters and verify count resets', async () => {
      await rollingStockSelector.toggleElectricRollingStockFilter();
      await rollingStockSelector.toggleThermalRollingStockFilter();
      expect(await rollingStockSelector.rollingStockList.count()).toEqual(
        initialRollingStockFoundNumber
      );
    });
  });

  /** *************** Test 5 **************** */
  test('Search for a rolling stock', async () => {
    const initialRollingStockFoundNumber = await rollingStockSelector.getRollingStockSearchNumber();

    await test.step('Search a specific rolling stock and verify icons', async () => {
      await rollingStockEditorPage.searchRollingStock(dualModeRollingStockName);
      expect(
        rollingStockEditorPage.page.getByTestId(`rollingstock-${dualModeRollingStockName}`)
      ).toBeDefined();

      await expect(rollingStockSelector.thermalRollingStockFirstIcon).toBeVisible();
      await expect(rollingStockSelector.electricRollingStockFirstIcon).toBeVisible();
    });

    await test.step('Clear search and verify count resets', async () => {
      await rollingStockEditorPage.clearSearchRollingStock();
      expect(await rollingStockSelector.rollingStockList.count()).toEqual(
        initialRollingStockFoundNumber
      );
    });

    await test.step('Search a non-existent rolling stock → expect no results', async () => {
      await rollingStockEditorPage.searchRollingStock(`${dualModeRollingStockName}-no-results`);
      await expect(rollingStockSelector.noRollingStockResult).toBeVisible();
      expect(await rollingStockSelector.getRollingStockSearchNumber()).toEqual(0);
    });
  });
});
