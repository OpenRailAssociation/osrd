import { expect, test } from '@playwright/test';

import type { Project, RollingStock, Scenario, Study } from 'common/api/osrdEditoastApi';

import OperationalStudiesPage from './pages/operational-studies-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page';
import ScenarioPage from './pages/scenario-page-model';
import { getRollingStock } from './utils/api-setup';
import setupScenario from './utils/scenario';

let project: Project;
let study: Study;
let scenario: Scenario;
let rollingStock: RollingStock;

const dualModeRollingStockName = 'dual-mode_rolling_stock_test_e2e';
const electricRollingStockName = 'electric_rolling_stock_test_e2e';

test.beforeAll(async () => {
  rollingStock = await getRollingStock(electricRollingStockName);

  // Create a new scenario
  ({ project, study, scenario } = await setupScenario());
});

test.beforeEach(async ({ page }) => {
  const scenarioPage = new ScenarioPage(page);

  // Navigate to the created scenario page
  await page.goto(
    `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
  );
  // Verify that the infrastructure is correctly loaded
  await scenarioPage.checkInfraLoaded();
});

test.describe('Verifying that all elements in the rolling stock tab are loaded correctly', () => {
  test('should correctly select a rolling stock for operational study', async ({ page }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const rollingStockSelector = new RollingStockSelectorPage(page);

    // Click on add train button
    await operationalStudiesPage.clickOnAddTrainBtn();

    // Verify the presence of warnings in Rolling Stock and Route Tab
    await operationalStudiesPage.verifyTabWarningPresence();

    // Open Rolling Stock Selector and search for the added train
    await operationalStudiesPage.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(dualModeRollingStockName);
    const rollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${dualModeRollingStockName}`
    );

    // Verify that the rolling stock card is inactive
    await expect(rollingstockCard).toHaveClass(/inactive/);

    // Verify that the rolling stock card is active after clicking on it
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    // Select the comfort AIR_CONDITIONING
    const comfortACRadioText = await rollingStockSelector.comfortACButton.innerText();
    await rollingStockSelector.comfortACButton.click();

    // Select the rolling stock
    await rollingstockCard.locator('button').click();

    // Verify that the correct comfort type is displayed
    const selectedComfortACText = await rollingStockSelector.getSelectedComfortType.innerText();
    expect(selectedComfortACText).toMatch(new RegExp(comfortACRadioText, 'i'));
  });

  test('should correctly modify a rolling stock for operational study', async ({ page }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const rollingStockSelector = new RollingStockSelectorPage(page);

    // Click on add train button
    await operationalStudiesPage.clickOnAddTrainBtn();

    // Open Rolling Stock Selector, search for the added train, and select it
    await operationalStudiesPage.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(electricRollingStockName);
    const fastRollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${rollingStock.name}`
    );
    await fastRollingstockCard.click();
    await fastRollingstockCard.locator('button').click();
    expect(await rollingStockSelector.getSelectedRollingStockName.innerText()).toEqual(
      electricRollingStockName
    );

    // Reopen the Rolling Stock selector from the selected card
    await operationalStudiesPage.openRollingStockSelector();

    // Apply thermal and electrical filters
    await rollingStockSelector.thermalRollingStockFilter();
    await rollingStockSelector.electricRollingStockFilter();

    // Select the dual mode rolling stock
    const dualModeRollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${dualModeRollingStockName}`
    );
    await dualModeRollingstockCard.click();
    await dualModeRollingstockCard.locator('button').click();

    // Verify that the correct rolling stock name is displayed
    expect(await rollingStockSelector.getSelectedRollingStockName.innerText()).toEqual(
      dualModeRollingStockName
    );
  });
});
