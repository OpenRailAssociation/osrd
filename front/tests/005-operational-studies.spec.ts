import { expect, test } from '@playwright/test';

import type { Project, RollingStock, Scenario, Study } from 'common/api/osrdEditoastApi';

import HomePage from './pages/home-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page';
import ScenarioPage from './pages/scenario-page-model';
import { getRollingStock } from './utils/api-setup';
import setupScenario from './utils/scenario';

let project: Project;
let study: Study;
let scenario: Scenario;
let rollingStock: RollingStock;

test.beforeAll(async () => {
  rollingStock = await getRollingStock('electric_rolling_stock_test_e2e');
});

test.beforeEach(async () => {
  ({ project, study, scenario } = await setupScenario());
});

test.describe('Testing if all mandatory elements simulation configuration are loaded in operational studies app', () => {
  test('Testing pathfinding with rollingstock and composition code', async ({ page }) => {
    // Add enough timeout to wait for the infra to be loaded
    test.slow();
    const homePage = new HomePage(page);
    const scenarioPage = new ScenarioPage(page);
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    await scenarioPage.checkInfraLoaded();
    await homePage.page.getByTestId('scenarios-add-train-schedule-button').click();

    await scenarioPage.setTrainScheduleName('TrainSchedule');
    const trainCount = '7';
    await scenarioPage.setNumberOfTrains(trainCount);

    // TODO: move this test in his own file
    // ***************** Test Rolling Stock *****************
    const rollingstockModalPage = new RollingStockSelectorPage(homePage.page);
    await expect(scenarioPage.getRollingStockSelector).toBeVisible();
    await rollingstockModalPage.openRollingstockModal();
    const rollingstockModal = rollingstockModalPage.rollingStockSelectorModal;
    await expect(rollingstockModal).toBeVisible();

    // Voluntarily add spaces and capital letters so we also test the normalization of the search functionality
    await rollingstockModalPage.searchRollingstock(' electric_rolling_stock_test_e2e ');

    const rollingstockCard = rollingstockModalPage.getRollingstockCardByTestID(
      `rollingstock-${rollingStock.name}`
    );
    await expect(rollingstockCard).toHaveClass(/inactive/);
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    await rollingstockCard.locator('button').click();

    expect(await rollingstockModalPage.getRollingStockMiniCardInfo().first().textContent()).toMatch(
      rollingStock.name
    );
    expect(await rollingstockModalPage.getRollingStockInfoComfort().textContent()).toMatch(
      /ConfortSStandard/i
    );

    // ***************** Test choice Origin/Destination *****************
    await scenarioPage.openTabByDataId('tab-pathfinding');
    const itinerary = scenarioPage.getItineraryModule;
    await expect(itinerary).toBeVisible();

    await scenarioPage.getPathfindingByTriGramSearch('MWS', 'NES');

    await scenarioPage.checkPathfindingDistance('33.950 km');

    // ***************** Test Add Train Schedule *****************
    await scenarioPage.addTrainSchedule();
    await scenarioPage.page.waitForSelector('.dots-loader', { state: 'hidden' });
    await scenarioPage.checkTrainHasBeenAdded();
    await scenarioPage.returnSimulationResult();
    await scenarioPage.checkNumberOfTrains(Number(trainCount));
  });
});
