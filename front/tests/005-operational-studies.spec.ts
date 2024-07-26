import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type {
  Infra,
  Project,
  RollingStock,
  Scenario,
  Study,
  Timetable,
} from 'common/api/osrdEditoastApi';

import scenarioData from './assets/operationStudies/scenario.json';
import HomePage from './pages/home-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page';
import ScenarioPage from './pages/scenario-page-model';
import { getProject, getStudy, getRollingStock, postApiRequest, getInfra } from './utils/index';

let smallInfra: Infra;
let project: Project;
let study: Study;
let scenario: Scenario;
let rollingStock: RollingStock;
let timetable: Timetable;

test.beforeAll(async () => {
  smallInfra = (await getInfra()) as Infra;
  project = await getProject();
  study = await getStudy(project.id);
  rollingStock = await getRollingStock();
});

test.beforeEach(async () => {
  timetable = await postApiRequest(`/api/v2/timetable/`, {
    electrical_profile_set_id: null,
  });
  scenario = await postApiRequest(`/api/v2/projects/${project.id}/studies/${study.id}/scenarios`, {
    ...scenarioData,
    name: `${scenarioData.name} ${uuidv4()}`,
    study_id: study.id,
    infra_id: smallInfra.id,
    timetable_id: timetable.id,
  });
});

test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app', () => {
  test('Testing pathfinding with rollingstock and composition code', async ({ page }) => {
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
    await rollingstockModalPage.searchRollingstock(' rollingstock_1500_25000_test_E2E ');

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

    await scenarioPage.checkPathfindingDistance('34.000 km');

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

    // ***************** Test Add Train Schedule *****************
    await scenarioPage.addTrainSchedule();
    await scenarioPage.page.waitForSelector('.dots-loader', { state: 'hidden' });
    await scenarioPage.checkTrainHasBeenAdded();
    await scenarioPage.returnSimulationResult();
    await scenarioPage.checkNumberOfTrains(Number(trainCount));
  });
});
