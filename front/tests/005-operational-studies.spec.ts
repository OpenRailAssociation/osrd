import { expect } from '@playwright/test';

import type { LightRollingStock, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import RoutePage from './pages/op-route-page-model';
import OperationalStudiesPage from './pages/operational-studies-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page-model';
import test from './test-logger';
import { getRollingStock } from './utils/api-setup';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';

test.describe('Verify simulation configuration in operational studies', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let rollingStock: LightRollingStock;

  test.beforeAll('Fetch rolling stock ', async () => {
    rollingStock = await getRollingStock('electric_rolling_stock_test_e2e');
  });

  test.beforeEach('Set up the project, study, and scenario', async () => {
    ({ project, study, scenario } = await createScenario());
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  /** *************** Test **************** */
  test('Pathfinding with rolling stock and composition code', async ({ page }) => {
    // Page models
    const [rollingstockPage, operationalStudiesPage, routePage] = [
      new RollingStockSelectorPage(page),
      new OperationalStudiesPage(page),
      new RoutePage(page),
    ];

    // Navigate to the scenario page for the given project and study
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    // Ensure infrastructure is loaded
    await operationalStudiesPage.checkInfraLoaded();

    // Click the button to add a train schedule
    await operationalStudiesPage.clickOnAddTrainButton();

    // Set the train schedule name and number of trains
    await operationalStudiesPage.setTrainScheduleName('TrainSchedule');
    await operationalStudiesPage.setNumberOfTrains('7');

    // Open the rolling stock modal

    await rollingstockPage.openRollingstockModal();
    await expect(rollingstockPage.rollingStockSelectorModal).toBeVisible();

    // Test rolling stock search with normalization (spaces and capital letters)
    await rollingstockPage.searchRollingstock(' electric_rolling_stock_test_E2E ');

    // Select the rolling stock card based on the test ID
    const rollingstockCard = rollingstockPage.getRollingstockCardByTestID(
      `rollingstock-${rollingStock.name}`
    );

    // Verify the rolling stock card is inactive initially
    await expect(rollingstockCard).toHaveClass(/inactive/);

    // Select the rolling stock and ensure it becomes active
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    // Confirm rolling stock selection by clicking the button on the card
    await rollingstockCard.locator('button').click();

    // Validate that the rolling stock's name and comfort class are displayed correctly
    expect(await rollingstockPage.getRollingStockMiniCardInfo().first().textContent()).toMatch(
      rollingStock.name
    );
    expect(await rollingstockPage.getRollingStockInfoComfort().textContent()).toMatch(
      /ConfortSStandard/i
    );

    // Perform Pathfinding and verify the distance
    await operationalStudiesPage.clickOnRouteTab();
    await routePage.performPathfindingByTrigram('MWS', 'NES');
    await operationalStudiesPage.checkPathfindingDistance('33.950 km');

    // Adding Train Schedule
    await operationalStudiesPage.addTrainSchedule();

    // Verify the train has been added and the simulation results
    await operationalStudiesPage.checkTrainHasBeenAdded();
    await operationalStudiesPage.returnSimulationResult();

    // Confirm the number of trains added matches the expected number
    await operationalStudiesPage.checkNumberOfTrains(7);
  });
});
