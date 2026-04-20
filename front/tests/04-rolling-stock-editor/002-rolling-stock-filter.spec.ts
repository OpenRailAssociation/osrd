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
      expect(await rollingStockEditorPage.electricRollingStockIcons.count()).toEqual(
        await rollingStockEditorPage.getRollingStockSearchNumber()
      );
    });

    await test.step('Clear Electric filter and verify initial count', async () => {
      await rollingStockEditorPage.toggleElectricRollingStockFilter();
      expect(await rollingStockEditorPage.rollingStockList.count()).toBeGreaterThanOrEqual(
        initialRollingStockFoundNumber
      );
    });

    await test.step('Toggle Thermal filter and verify count', async () => {
      await rollingStockEditorPage.toggleThermalRollingStockFilter();
      expect(await rollingStockEditorPage.thermalRollingStockIcons.count()).toEqual(
        await rollingStockEditorPage.getRollingStockSearchNumber()
      );
    });

    await test.step('Toggle Electric with Thermal on (dual-mode) and verify count', async () => {
      await rollingStockEditorPage.toggleElectricRollingStockFilter();
      expect(await rollingStockEditorPage.dualModeRollingStockIcons.count()).toEqual(
        await rollingStockEditorPage.getRollingStockSearchNumber()
      );
    });

    await test.step('Clear both filters and verify count resets', async () => {
      await rollingStockEditorPage.toggleElectricRollingStockFilter();
      await rollingStockEditorPage.toggleThermalRollingStockFilter();
      const currentCount = await rollingStockEditorPage.rollingStockList.count();
      expect(currentCount).toEqual(initialRollingStockFoundNumber);
    });
  });

  /** *************** Test 2 **************** */
  test('Search for a rolling stock', async ({ rollingStockEditorPage }) => {
    const initialRollingStockFoundNumber =
      await rollingStockEditorPage.getRollingStockSearchNumber();

    await test.step('Search a specific rolling stock and verify icons', async () => {
      await rollingStockEditorPage.searchRollingStock(dualModeRollingStockName);
      expect(
        rollingStockEditorPage.page.getByTestId(`rollingstock-${dualModeRollingStockName}`)
      ).toBeDefined();

      await expect(rollingStockEditorPage.thermalRollingStockFirstIcon).toBeVisible();
      await expect(rollingStockEditorPage.electricRollingStockFirstIcon).toBeVisible();
    });

    await test.step('Clear search and verify count resets', async () => {
      await rollingStockEditorPage.clearSearchRollingStock();
      expect(await rollingStockEditorPage.rollingStockList.count()).toEqual(
        initialRollingStockFoundNumber
      );
    });

    await test.step('Search a non-existent rolling stock → expect no results', async () => {
      await rollingStockEditorPage.searchRollingStock(
        `${dualModeRollingStockName}-no-results`,
        false
      );
      await expect(rollingStockEditorPage.noRollingStockResult).toBeVisible();
      expect(await rollingStockEditorPage.getRollingStockSearchNumber()).toEqual(0);
    });
  });
});
