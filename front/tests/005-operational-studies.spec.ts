import { test, expect } from '@playwright/test';
import type { Project, RollingStock, Scenario, Study } from 'common/api/osrdEditoastApi';
import { PlaywrightHomePage } from './pages/home-page-model';
import RollingStockSelectorPage from './pages/rolling-stock-selector-page';
import PlaywrightMap from './pages/map-model';
import PATH_VARIABLES from './assets/operationStudies/testVariablesPaths';
import PlaywrightScenarioPage from './pages/scenario-page-model';
import { getProject, getStudy, getScenario, getRollingStock } from './assets/utils';

let project: Project;
let study: Study;
let scenario: Scenario;
let rollingStock: RollingStock;

test.beforeAll(async () => {
  project = await getProject();
  study = await getStudy(project.id);
  scenario = await getScenario(project.id, study.id);
  rollingStock = await getRollingStock();
});

// TODO: remove (enabled) when every tests are refactored
test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app (enabled)', () => {
  test('Testing pathfinding with rollingstock and composition code', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const scenarioPage = new PlaywrightScenarioPage(page);

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    await scenarioPage.checkInfraLoaded();
    await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();

    await scenarioPage.setTrainScheduleName('TrainSchedule');
    const trainCount = '7';
    await scenarioPage.setNumberOfTrains(trainCount);

    // TODO: move this test in his own file
    // ***************** Test Rolling Stock *****************
    const playwrightRollingstockModalPage = new RollingStockSelectorPage(playwrightHomePage.page);
    await expect(scenarioPage.getRollingStockSelector).toBeVisible();
    await playwrightRollingstockModalPage.openRollingstockModal();
    const rollingstockModal = playwrightRollingstockModalPage.rollingStockSelectorModal;
    await expect(rollingstockModal).toBeVisible();

    await playwrightRollingstockModalPage.searchRollingstock('rollingstock_1500_25000_test_e2e');

    const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
      `rollingstock-${rollingStock.name}`
    );
    await expect(rollingstockCard).toHaveClass(/inactive/);
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    await rollingstockCard.locator('button').click();

    expect(
      await playwrightRollingstockModalPage.getRollingStockMiniCardInfo().first().textContent()
    ).toMatch(rollingStock.name);
    expect(
      await playwrightRollingstockModalPage.getRollingStockInfoComfort().textContent()
    ).toMatch(/ConfortSStandard/i);

    // TODO: move this test in his own file
    // ***************** Test Composition Code *****************
    await scenarioPage.openTabByDataId('tab-simulation-settings');
    await expect(scenarioPage.getSpeedLimitSelector).toBeVisible();
    await scenarioPage.getSpeedLimitSelector.click();
    await scenarioPage.getSpeedLimitSelector.locator('input').fill('32');
    await scenarioPage.getSpeedLimitSelector
      .getByRole('button', { name: 'Voyageurs - Automoteurs - E32C' })
      .click();
    expect(await scenarioPage.getSpeedLimitSelector.textContent()).toMatch(
      /Voyageurs - Automoteurs - E32C/i
    );

    // ***************** Test choice Origin/Destination *****************
    const playwrightMap = new PlaywrightMap(playwrightHomePage.page);
    await scenarioPage.openTabByDataId('tab-pathfinding');
    await playwrightMap.disableLayers();
    const itinerary = scenarioPage.getItineraryModule;
    await expect(itinerary).toBeVisible();
    await expect(scenarioPage.getMapModule).toBeVisible();

    // Search and select origin
    await playwrightMap.selectOrigin(PATH_VARIABLES.originSearch);

    // Search and select destination
    await playwrightMap.selectDestination(PATH_VARIABLES.destinationSearch);

    await scenarioPage.checkPathfindingDistance('34.000 km');

    // ***************** Test Add Train Schedule *****************
    await scenarioPage.addTrainSchedule();
    await scenarioPage.page.waitForSelector('.dots-loader', { state: 'hidden' });
    await scenarioPage.checkToastSNCFTitle();
    await scenarioPage.returnSimulationResult();
    await scenarioPage.checkNumberOfTrains(Number(trainCount));
  });
});
