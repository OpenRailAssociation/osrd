import { expect } from '@playwright/test';

import type {
  Infra,
  LightRollingStock,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import {
  dualModeRollingStockName,
  electricRollingStockName,
} from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra, getRollingStock } from './utils/api-utils';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';

test.describe('Rolling stock Tab Verification', () => {
  let operationalStudiesPage: OperationalStudiesPage;
  let rollingStockSelector: RollingStockSelector;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let rollingStock: LightRollingStock;
  let infra: Infra;

  test.beforeAll('Set up a scenario before all tests', async () => {
    rollingStock = await getRollingStock(electricRollingStockName);
    ({ project, study, scenario } = await createScenario());
    infra = await getInfra();
  });

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test.beforeEach('Navigate to the scenario page', async ({ page }) => {
    [operationalStudiesPage, rollingStockSelector] = [
      new OperationalStudiesPage(page),
      new RollingStockSelector(page),
    ];
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );
    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Select a rolling stock for operational study', async () => {
    // Add a train and verify the presence of warnings
    await operationalStudiesPage.clickOnAddTrainButton();
    await operationalStudiesPage.verifyTabWarningPresence();

    // Open the Rolling Stock Selector and search for the dual-mode rolling stock
    await rollingStockSelector.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(dualModeRollingStockName);

    // Locate the rolling stock card and verify its inactive state
    const rollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${dualModeRollingStockName}`
    );
    await expect(rollingstockCard).toHaveClass(/inactive/);

    // Click on the rolling stock card to activate it
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    // Select the comfort option (AIR_CONDITIONING) and confirm the selection
    const comfortACRadioText = await rollingStockSelector.comfortACButton.innerText();
    await rollingStockSelector.comfortACButton.click();
    await rollingstockCard.locator('button').click();

    // Verify that the correct comfort type is displayed after selection
    const selectedComfortACText = await rollingStockSelector.selectedComfortType.innerText();
    expect(selectedComfortACText).toMatch(new RegExp(comfortACRadioText, 'i'));
  });

  /** *************** Test 2 **************** */
  test('Modify a rolling stock for operational study', async () => {
    // Add a train and select the electric rolling stock
    await operationalStudiesPage.clickOnAddTrainButton();
    await rollingStockSelector.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(electricRollingStockName);
    const fastRollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${rollingStock.name}`
    );

    // Select the rolling stock and confirm the selection
    await fastRollingstockCard.click();
    await fastRollingstockCard.locator('button').click();
    expect(await rollingStockSelector.selectedRollingStockName.innerText()).toEqual(
      electricRollingStockName
    );

    // Reopen the rolling stock selector and apply filters
    await rollingStockSelector.openRollingstockModal();
    await rollingStockSelector.setThermalRollingStockFilter();
    await rollingStockSelector.setElectricRollingStockFilter();

    // Select the dual-mode rolling stock and confirm the selection
    const dualModeRollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${dualModeRollingStockName}`
    );
    await dualModeRollingstockCard.click();
    await dualModeRollingstockCard.locator('button').click();

    // Verify that the correct dual-mode rolling stock is displayed
    expect(await rollingStockSelector.selectedRollingStockName.innerText()).toEqual(
      dualModeRollingStockName
    );
  });
});
