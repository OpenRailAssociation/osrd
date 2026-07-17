import { expect } from '@playwright/test';

import { dualModeRollingStockName } from './../assets/constants/project-const';
import test from './../page-object-fixture';

test.describe('Rolling stock editor filter', { tag: ['@rs-editor', '@filter'] }, () => {
  test.beforeEach('Navigate to editor page', async ({ rollingStockEditorPage }) => {
    await rollingStockEditorPage.navigateToRollingStockPage();
  });

  /** *************** Test 1 **************** */
  test('Filtering rolling stocks', async ({ rollingStockEditorPage }) => {
    const initialRollingStockFoundNumber =
      await rollingStockEditorPage.getRollingStockSearchNumber();

    await test.step('Toggle Electric filter and verify count', async () => {
      await rollingStockEditorPage.toggleElectricRollingStockFilter();
      await expect
        .poll(async () => {
          const iconCount = await rollingStockEditorPage.electricRollingStockIcons.count();
          const searchNumber = await rollingStockEditorPage.getRollingStockSearchNumber();
          return iconCount === searchNumber;
        })
        .toBe(true);
    });

    await test.step('Clear Electric filter and verify initial count', async () => {
      await rollingStockEditorPage.toggleElectricRollingStockFilter();
      await expect
        .poll(() => rollingStockEditorPage.rollingStockList.count())
        .toBeGreaterThanOrEqual(initialRollingStockFoundNumber);
    });

    await test.step('Toggle Thermal filter and verify count', async () => {
      await rollingStockEditorPage.toggleThermalRollingStockFilter();
      await expect
        .poll(async () => {
          const iconCount = await rollingStockEditorPage.thermalRollingStockIcons.count();
          const searchNumber = await rollingStockEditorPage.getRollingStockSearchNumber();
          return iconCount === searchNumber;
        })
        .toBe(true);
    });

    await test.step('Toggle Electric with Thermal on (dual-mode) and verify count', async () => {
      await rollingStockEditorPage.toggleElectricRollingStockFilter();
      await expect
        .poll(async () => {
          const iconCount = await rollingStockEditorPage.dualModeRollingStockIcons.count();
          const searchNumber = await rollingStockEditorPage.getRollingStockSearchNumber();
          return iconCount === searchNumber;
        })
        .toBe(true);
    });

    await test.step('Clear both filters and verify count resets', async () => {
      await rollingStockEditorPage.toggleElectricRollingStockFilter();
      await rollingStockEditorPage.toggleThermalRollingStockFilter();
      await expect(rollingStockEditorPage.rollingStockList).toHaveCount(
        initialRollingStockFoundNumber
      );
    });
  });

  /** *************** Test 2 **************** */
  test('Search for a rolling stock', async ({ rollingStockEditorPage }) => {
    const initialRollingStockFoundNumber =
      await rollingStockEditorPage.getRollingStockSearchNumber();

    await test.step('Search a specific rolling stock and verify icons', async () => {
      await rollingStockEditorPage.searchRollingStock(dualModeRollingStockName);
      await expect(
        rollingStockEditorPage.page.getByTestId(`rollingstock-${dualModeRollingStockName}`)
      ).toBeVisible();

      await expect(rollingStockEditorPage.thermalRollingStockFirstIcon).toBeVisible();
      await expect(rollingStockEditorPage.electricRollingStockFirstIcon).toBeVisible();
    });

    await test.step('Clear search and verify count resets', async () => {
      await rollingStockEditorPage.clearSearchRollingStock();
      await expect(rollingStockEditorPage.rollingStockList).toHaveCount(
        initialRollingStockFoundNumber
      );
    });

    await test.step('Search a non-existent rolling stock → expect no results', async () => {
      await rollingStockEditorPage.searchRollingStock(
        `${dualModeRollingStockName}-no-results`,
        false
      );
      await expect(rollingStockEditorPage.noRollingStockResult).toBeVisible();
      await expect.poll(() => rollingStockEditorPage.getRollingStockSearchNumber()).toEqual(0);
    });
  });
});
