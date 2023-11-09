import { test, expect } from '@playwright/test';
import { Project, Infra, ScenarioResult, Study, RollingStock } from 'common/api/osrdEditoastApi';
import { v4 as uuidv4 } from 'uuid';
import { PlaywrightHomePage } from './pages/home-page-model';
import PlaywrightRollingstockModalPage from './pages/rollingstock-modal-model';
import exampleRollingStock from './assets/example_rolling_stock_1.json';
import exampleRollingStock1500 from './assets/example_rolling_stock_1500.json';
import exampleRollingStock25000 from './assets/example_rolling_stock_25000.json';
import project from './assets/operationStudies/project.json';
import study from './assets/operationStudies/study.json';
import scenario from './assets/operationStudies/scenario.json';
import PlaywrightMap from './pages/map-model';
import VARIABLES from './assets/operationStudies/testVariables';
import PATH_VARIABLES from './assets/operationStudies/testVariablesPaths';
import PlaywrightScenarioPage from './pages/scenario-page-model';
import { ProjectPage } from './pages/project-page-model';
import { StudyPage } from './pages/study-page-model';
import { postApiRequest, deleteApiRequest, getSmallInfra } from './assets/utils';

let newProjectData: Project;
let newStudyData: Study;
let newScenarioData: ScenarioResult;
let rollingStock1: RollingStock;
let rollingStock2: RollingStock;
let rollingStock3: RollingStock;

test.beforeEach(async () => {
  rollingStock1 = await postApiRequest('/rolling_stock/', {
    ...exampleRollingStock,
    name: `${exampleRollingStock.name} ${uuidv4()}`,
  });

  rollingStock2 = await postApiRequest('/rolling_stock/', {
    ...exampleRollingStock1500,
    name: `${exampleRollingStock1500.name} ${uuidv4()}`,
  });

  rollingStock3 = await postApiRequest('/rolling_stock/', {
    ...exampleRollingStock25000,
    name: `${exampleRollingStock25000.name} ${uuidv4()}`,
  });

  newProjectData = await postApiRequest('/projects/', {
    ...project,
    name: `${project.name} ${uuidv4()}`,
    budget: 1234567890,
  });

  newStudyData = await postApiRequest(`/projects/${newProjectData.id}/studies`, {
    ...study,
    name: `${study.name} ${uuidv4()}`,
    budget: 1234567890,
    project_id: newProjectData.id,
  });

  newScenarioData = await postApiRequest(
    `/projects/${newProjectData.id}/studies/${newStudyData.id}/scenarios`,
    {
      ...scenario,
      name: `${scenario.name} ${uuidv4()}`,
      study_id: newStudyData.id,
      infra_id: getSmallInfra().id,
    }
  );
});

test.afterEach(async () => {
  await deleteApiRequest(`/projects/${newProjectData.id}/`);

  await deleteApiRequest(`/rolling_stock/${rollingStock1.id}/`);

  await deleteApiRequest(`/rolling_stock/${rollingStock2.id}/`);

  await deleteApiRequest(`/rolling_stock/${rollingStock3.id}/`);
});

// TODO: remove (enabled) when every tests are refactored
test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app (enabled)', () => {
  test('Testing pathfinding with rollingstock and composition code', async ({ page }) => {
    console.log(getSmallInfra().id);
    test.setTimeout(180000); // 1min30
    const playwrightHomePage = new PlaywrightHomePage(page);
    const scenarioPage = new PlaywrightScenarioPage(page);
    const projectPage = new ProjectPage(page);
    const studyPage = new StudyPage(page);

    await playwrightHomePage.goToHomePage();

    // Real click on project, study, scenario
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(newProjectData.name);
    await studyPage.openStudyByTestId(newStudyData.name);

    await scenarioPage.openScenarioCreationModal();
    await scenarioPage.setScenarioName(newScenarioData.name as string);
    await scenarioPage.setScenarioInfraByName(getSmallInfra().name);
    const createButton = playwrightHomePage.page.getByTestId('createScenario');
    await createButton.click();

    await scenarioPage.checkInfraLoaded();
    await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();

    await scenarioPage.setTrainScheduleName('TrainSchedule');
    const trainCount = '7';
    await scenarioPage.setNumberOfTrains(trainCount);

    // ***************** Test Rolling Stock *****************
    const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
      playwrightHomePage.page
    );
    await expect(scenarioPage.getRollingStockSelector).toBeVisible();
    await playwrightRollingstockModalPage.openRollingstockModal();
    const rollingstockModal = playwrightRollingstockModalPage.getRollingstockModal;
    await expect(rollingstockModal).toBeVisible();

    // TODO: find a way to set global variables, then isolate those variables by test group
    // await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
    //   VARIABLES.numberOfRollingstock
    // );

    // TODO: as above
    await playwrightRollingstockModalPage.getElectricalCheckbox.click();
    // await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
    //   VARIABLES.numberOfRollingstockWithElectrical
    // );

    // TODO: as above
    await playwrightRollingstockModalPage.searchRollingstock(VARIABLES.searchRollingstock);
    // await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
    //   VARIABLES.numberOfRollingstockWithSearch
    // );

    const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
      `rollingstock-${rollingStock1.name}`
    );
    await expect(rollingstockCard).toHaveClass(/inactive/);
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    await rollingstockCard.locator('button').click();

    expect(
      await playwrightRollingstockModalPage.getRollingStockMiniCardInfo().first().textContent()
    ).toMatch(VARIABLES.rollingStockInfo);
    expect(
      await playwrightRollingstockModalPage.getRollingStockInfoComfort().textContent()
    ).toMatch(/ConfortSStandard/i);

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
    await playwrightMap.page.waitForTimeout(2000);
    const itinerary = scenarioPage.getItineraryModule;
    await expect(itinerary).toBeVisible();
    await expect(scenarioPage.getMapModule).toBeVisible();

    // Search and select origin
    await playwrightMap.selectOrigin(PATH_VARIABLES.originSearch);

    // Search and select destination
    await playwrightMap.selectDestination(PATH_VARIABLES.destinationSearch);

    await scenarioPage.checkPathfindingDistance(VARIABLES.pathfindingDistance);

    // ***************** Test Add Train Schedule *****************
    await scenarioPage.addTrainSchedule();
    await scenarioPage.page.waitForSelector('.dots-loader', { state: 'hidden' });
    await scenarioPage.checkToastSNCFTitle();
    await scenarioPage.returnSimulationResult();
    await scenarioPage.checkNumberOfTrains(Number(trainCount));
  });
});
