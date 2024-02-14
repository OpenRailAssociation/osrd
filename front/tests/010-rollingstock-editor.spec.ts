import { test, expect } from '@playwright/test';
import { RollingStock } from 'common/api/osrdEditoastApi';
import { PlaywrightRollingstockEditorPage } from './pages/rollingstock-editor-page-model';
import { deleteApiRequest } from './assets/utils';

test.describe('Rollingstock editor page', () => {
  test('should correctly create a new rolling stock (enabled)', async ({ page }) => {
    const playwrightRollingstockEditorPage = new PlaywrightRollingstockEditorPage(page);

    await playwrightRollingstockEditorPage.navigateToPage();

    await playwrightRollingstockEditorPage.clickOnNewRollingstockButton();

    await playwrightRollingstockEditorPage.fillAndCheckInputById('name', 'Test_name');
    await playwrightRollingstockEditorPage.fillAndCheckInputById('detail', 'Test detail');
    await playwrightRollingstockEditorPage.fillAndCheckInputById('family', 'Test family');
    await playwrightRollingstockEditorPage.fillAndCheckInputById('grouping', 'Test grouping');

    await playwrightRollingstockEditorPage.fillAndCheckInputById('number', 500);
    await playwrightRollingstockEditorPage.fillAndCheckInputById('reference', 'Test reference');
    await playwrightRollingstockEditorPage.fillAndCheckInputById('series', 'Test series');

    await playwrightRollingstockEditorPage.fillAndCheckInputById('subseries', 'Test subseries');
    await playwrightRollingstockEditorPage.fillAndCheckInputById('type', 'Test type');
    await playwrightRollingstockEditorPage.fillAndCheckInputById('unit', 'Test unit');

    await playwrightRollingstockEditorPage.fillAndCheckInputById('length', 50);
    await playwrightRollingstockEditorPage.fillAndCheckInputById('mass-input', 80, true);
    await playwrightRollingstockEditorPage.fillAndCheckInputById('maxSpeed', 200);
    await playwrightRollingstockEditorPage.fillAndCheckInputById('startupTime', 5);
    await playwrightRollingstockEditorPage.fillAndCheckInputById('startupAcceleration', 5);

    await playwrightRollingstockEditorPage.fillAndCheckInputById('comfortAcceleration', 1);
    await playwrightRollingstockEditorPage.fillAndCheckInputById('inertiaCoefficient', 1);
    await playwrightRollingstockEditorPage.fillAndCheckInputById('gammaValue', 1);
    const loadingGauge = playwrightRollingstockEditorPage.getRollingStockInputById('loadingGauge');
    await loadingGauge.selectOption('GA');
    expect(await loadingGauge.inputValue()).toBe('GA');
    await playwrightRollingstockEditorPage.fillAndCheckInputById('basePowerClass', 7);

    await playwrightRollingstockEditorPage.fillAndCheckInputById(
      'rollingResistanceA-input',
      1105,
      true
    );
    await playwrightRollingstockEditorPage.fillAndCheckInputById(
      'rollingResistanceB-input',
      30,
      true
    );
    await playwrightRollingstockEditorPage.fillAndCheckInputById(
      'rollingResistanceC-input',
      2,
      true
    );

    await playwrightRollingstockEditorPage.clickOnSubmitRollingstockButton();

    await playwrightRollingstockEditorPage.checkToastSNCFTitle(/Formulaire incomplet/);

    await playwrightRollingstockEditorPage.clickOnSpeedEffortCurvesButton();

    // Select and check traction mode
    const tractionModesSelector =
      playwrightRollingstockEditorPage.getRollingStockInputByTestId('traction-mode-selector');

    await tractionModesSelector.getByRole('button').click();

    await tractionModesSelector
      .getByRole('button', {
        name: '1500V',
        exact: true,
      })
      .click();

    await expect(tractionModesSelector.getByTitle('1500V')).toBeVisible();

    // Select and check power restriction
    const powerRestrictionSelector = playwrightRollingstockEditorPage.getRollingStockInputByTestId(
      'power-restriction-selector'
    );

    // Complete the speed effort curves Not specified

    const velocityCellRow0 = playwrightRollingstockEditorPage.getVelocityCellByRow('0');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('0', velocityCellRow0);

    const effortCellRow0 = playwrightRollingstockEditorPage.getEffortCellByRow('0');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('30500', effortCellRow0);

    const velocityCellRow1 = playwrightRollingstockEditorPage.getVelocityCellByRow('1');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('5', velocityCellRow1);

    const effortCellRow1 = playwrightRollingstockEditorPage.getEffortCellByRow('1');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('30000', effortCellRow1);

    // Select and complete the speed effort curves C0
    await powerRestrictionSelector.getByRole('button').nth(1).click();
    const powerRestrictionModal =
      playwrightRollingstockEditorPage.getRollingStockInputById('modal-body');

    await powerRestrictionModal.getByTitle('C1 ', { exact: true }).click();

    await expect(powerRestrictionSelector.getByTitle('C1')).toBeVisible();

    await playwrightRollingstockEditorPage.setSpreedsheetCell('0', velocityCellRow0);

    await playwrightRollingstockEditorPage.setSpreedsheetCell('30500', effortCellRow0);

    await playwrightRollingstockEditorPage.setSpreedsheetCell('5', velocityCellRow1);

    await playwrightRollingstockEditorPage.setSpreedsheetCell('30000', effortCellRow1);

    const velocityCellRow2 = playwrightRollingstockEditorPage.getVelocityCellByRow('2');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('10', velocityCellRow2);

    const effortCellRow2 = playwrightRollingstockEditorPage.getEffortCellByRow('2');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('25000', effortCellRow2);

    const velocityCellRow3 = playwrightRollingstockEditorPage.getVelocityCellByRow('3');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('20', velocityCellRow3);

    const effortCellRow3 = playwrightRollingstockEditorPage.getEffortCellByRow('3');
    await playwrightRollingstockEditorPage.setSpreedsheetCell('20000', effortCellRow3);

    await playwrightRollingstockEditorPage.clickOnRollingstockDetailsButton();

    await playwrightRollingstockEditorPage.fillAndCheckInputById('electricalPowerStartupTime', 1);

    await playwrightRollingstockEditorPage.fillAndCheckInputById('raisePantographTime', 20);

    await playwrightRollingstockEditorPage.clickOnSubmitRollingstockButton();

    const reponsePromise = playwrightRollingstockEditorPage.page.waitForResponse((response) =>
      response.url().includes('/api/rolling_stock/')
    );

    // Confirm the creation of the rolling stock
    await playwrightRollingstockEditorPage.page.getByText('Oui', { exact: true }).click();

    expect(
      playwrightRollingstockEditorPage.page.getByTestId(`rollingstock-Test_name`)
    ).toBeDefined();

    // Delete the rolling stock created
    const response = await reponsePromise;
    const responseJSON: RollingStock = await response.json();
    await deleteApiRequest(`/api/rolling_stock/${responseJSON.id}/`);
  });

  test('should correctly duplicate and modify a rolling stock (enabled)', async ({ page }) => {
    const playwrightRollingstockEditorPage = new PlaywrightRollingstockEditorPage(page);

    await playwrightRollingstockEditorPage.navigateToPage();

    const rollingStockCard = playwrightRollingstockEditorPage.page.getByTestId(
      `rollingstock-rollingstock_1500_25000_test_e2e`
    );

    await rollingStockCard.click();

    const reponsePromise = playwrightRollingstockEditorPage.page.waitForResponse((response) =>
      response.url().includes('/api/rolling_stock/')
    );

    const duplicateRollingStockButton = playwrightRollingstockEditorPage.page
      .locator('.rollingstock-editor-buttons')
      .locator('button')
      .nth(1);

    await duplicateRollingStockButton.click();

    await playwrightRollingstockEditorPage.fillAndCheckInputById('name', 'rollingstock_copied');

    await playwrightRollingstockEditorPage.clickOnSubmitRollingstockButton();

    await playwrightRollingstockEditorPage.page.getByText('Oui', { exact: true }).click();

    await playwrightRollingstockEditorPage.getRollingStockSearchInput.fill('rollingstock_copied');

    expect(
      playwrightRollingstockEditorPage.page.getByTestId(`rollingstock-rollingstock_copied`)
    ).toBeDefined();

    // Delete the rolling stock duplicated
    const response = await reponsePromise;
    const responseJSON: RollingStock = await response.json();
    await deleteApiRequest(`/api/rolling_stock/${responseJSON.id}/`);
  });
});
