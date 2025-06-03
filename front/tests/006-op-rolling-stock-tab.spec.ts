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

test.describe.skip('Rolling stock Tab Verification', () => {
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
    await operationalStudiesPage.openTimetableItemForm();
  });

  /** *************** Test 1 **************** */
  test('Select a rolling stock for operational study', async () => {
    // Verify the presence of warnings
    await operationalStudiesPage.verifyTabWarningPresence();

    // Open the Rolling Stock Selector and search for the dual-mode rolling stock
    await rollingStockSelector.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(dualModeRollingStockName);

    // Locate the rolling stock card and verify its inactive state

    await rollingStockSelector.verifyRollingStockIsInactive(dualModeRollingStockName);

    // Click on the rolling stock card to activate it
    await rollingStockSelector.selectRollingStockCard({ name: dualModeRollingStockName });

    // Select the comfort option (AIR_CONDITIONING) and confirm the selection
    const comfortACRadioText = await rollingStockSelector.comfortACButton.innerText();
    await rollingStockSelector.selectRollingStockCard({
      name: dualModeRollingStockName,
      selectComfort: true,
      confirmSelection: true,
    });

    // Verify that the correct comfort type is displayed after selection

    await rollingStockSelector.verifySelectedComfortMatches(comfortACRadioText);
  });

  /** *************** Test 2 **************** */
  test('Modify a rolling stock for operational study', async () => {
    // Select the electric rolling stock
    await rollingStockSelector.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(electricRollingStockName);
    await rollingStockSelector.selectRollingStockCard({
      name: rollingStock.name,
      selectComfort: false,
      confirmSelection: true,
    });
    expect(await rollingStockSelector.selectedRollingStockName.innerText()).toEqual(
      electricRollingStockName
    );

    // Reopen the rolling stock selector and apply filters
    await rollingStockSelector.openRollingstockModal();
    await rollingStockSelector.setThermalRollingStockFilter();
    await rollingStockSelector.setElectricRollingStockFilter();

    // Select the dual-mode rolling stock and confirm the selection
    await rollingStockSelector.selectRollingStockCard({
      name: dualModeRollingStockName,
      selectComfort: false,
      confirmSelection: true,
    });

    // Verify that the correct dual-mode rolling stock is displayed
    expect(await rollingStockSelector.selectedRollingStockName.innerText()).toEqual(
      dualModeRollingStockName
    );
  });
});
