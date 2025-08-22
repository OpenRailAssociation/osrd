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
    await waitForInfraStateToBeCached(infra.id);
    await operationalStudiesPage.openTimetableItemForm();
  });

  /** *************** Test 1 **************** */
  test('Select a rolling stock for operational study', async () => {
    await test.step('Verify tab warnings are present', async () => {
      await operationalStudiesPage.verifyTabWarningPresence();
    });

    await test.step('Open selector and search dual-mode rolling stock', async () => {
      await rollingStockSelector.openEmptyRollingStockSelector();
      await rollingStockSelector.searchRollingstock(dualModeRollingStockName);
    });

    await test.step('Verify RS card is inactive before selection', async () => {
      await rollingStockSelector.verifyRollingStockIsInactive(dualModeRollingStockName);
    });

    await test.step('Activate RS card', async () => {
      await rollingStockSelector.selectRollingStockCard({ name: dualModeRollingStockName });
    });

    await test.step('Select AIR_CONDITIONING comfort and confirm the new RS is displayed', async () => {
      const comfortACRadioText = await rollingStockSelector.comfortACButton.innerText();
      await rollingStockSelector.selectRollingStockCard({
        name: dualModeRollingStockName,
        selectComfort: true,
        confirmSelection: true,
      });
      await rollingStockSelector.verifySelectedComfortMatches(comfortACRadioText);
    });
  });

  /** *************** Test 2 **************** */
  test('Modify a rolling stock for operational study', async () => {
    await test.step('Select electric rolling stock', async () => {
      await rollingStockSelector.openEmptyRollingStockSelector();
      await rollingStockSelector.searchRollingstock(electricRollingStockName);
      await rollingStockSelector.selectRollingStockCard({
        name: rollingStock.name,
        confirmSelection: true,
      });
      expect(await rollingStockSelector.selectedRollingStockName.innerText()).toEqual(
        electricRollingStockName
      );
    });

    await test.step('Open selector and toggle Thermal + Electric filters', async () => {
      await rollingStockSelector.openRollingstockModal();
      await rollingStockSelector.toggleThermalRollingStockFilter();
      await rollingStockSelector.toggleElectricRollingStockFilter();
    });

    await test.step('Select dual-mode rolling stock and confirm the new RS is displayed', async () => {
      await rollingStockSelector.selectRollingStockCard({
        name: dualModeRollingStockName,
        confirmSelection: true,
      });
      expect(await rollingStockSelector.selectedRollingStockName.innerText()).toEqual(
        dualModeRollingStockName
      );
    });
  });
});
