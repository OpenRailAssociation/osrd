import { expect } from '@playwright/test';

import { electricRollingStockName } from './../assets/constants/project-const';
import test from './../page-object-fixture';
import { readJsonFile } from './../utils/file-utils';
import {
  generateUniqueName,
  verifyAndCheckInputById,
  fillAndCheckInputById,
} from './../utils/index';
import { deleteRollingStocks } from './../utils/teardown-utils';
import type { RollingStockDetails } from './../utils/types';

const rollingstockDetails: RollingStockDetails = readJsonFile(
  './tests/assets/rolling-stock/rolling-stock-details.json'
);

test.describe('Rolling stock editor management', { tag: '@rs-editor' }, () => {
  const createdRollingStocks: string[] = [];

  let uniqueRollingStockName: string;
  let uniqueUpdatedRollingStockName: string;
  let uniqueDeletedRollingStockName: string;

  test.beforeEach(async ({ rollingStockEditorPage }) => {
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

  test.afterAll(async () => {
    if (createdRollingStocks.length > 0) {
      await deleteRollingStocks(createdRollingStocks);
    }
  });

  /** *************** Test 1 **************** */
  test(
    'Create a new rolling stock',
    { tag: '@smoke' },
    async ({ page, rollingStockEditorPage }) => {
      createdRollingStocks.push(uniqueRollingStockName);

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

      await test.step('Select categories (primary + other)', async () => {
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
    }
  );

  /** *************** Test 2 **************** */
  test('Duplicate and modify a rolling stock', async ({ page, rollingStockEditorPage }) => {
    createdRollingStocks.push(uniqueUpdatedRollingStockName);

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
  });

  /** *************** Test 3 **************** */
  test('Duplicate and delete a rolling stock', async ({ page, rollingStockEditorPage }) => {
    createdRollingStocks.push(uniqueDeletedRollingStockName);

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
      await rollingStockEditorPage.searchRollingStock(uniqueDeletedRollingStockName, false);
      await expect(rollingStockEditorPage.noRollingStockResult).toBeVisible();
      await expect.poll(() => rollingStockEditorPage.getRollingStockSearchNumber()).toEqual(0);
    });
  });
});
