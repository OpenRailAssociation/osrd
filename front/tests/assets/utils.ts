import { expect, Page, request } from '@playwright/test';
import type { Project, Scenario, Study, RollingStock, Infra } from 'common/api/osrdEditoastApi';
import { PlaywrightHomePage } from '../pages/home-page-model';
import PlaywrightRollingstockModalPage from '../pages/rollingstock-modal-model';
import PlaywrightMap, { selectPointOnMapProps } from '../pages/map-model';
import PlaywrightScenarioPage from '../pages/scenario-page-model';
import { ProjectPage } from '../pages/project-page-model';
import { StudyPage } from '../pages/study-page-model';

export default async function createCompleteScenario(
  page: Page,
  scenarioName: string,
  trainScheduleName: string,
  trainCount: string,
  delta: string,
  originSearch: selectPointOnMapProps,
  destinationSearch: selectPointOnMapProps,
  pathfindingDistance: string | RegExp
) {
  const playwrightHomePage = new PlaywrightHomePage(page);
  const scenarioPage = new PlaywrightScenarioPage(page);
  const projectPage = new ProjectPage(page);
  const studyPage = new StudyPage(page);
  const playwrightMap = new PlaywrightMap(playwrightHomePage.page);

  await playwrightHomePage.goToHomePage();

  // Real click on project, study, scenario
  await playwrightHomePage.goToOperationalStudiesPage();
  await projectPage.openProjectByTestId('_@Test integration project');
  await studyPage.openStudyByTestId('_@Test integration study');

  await scenarioPage.openScenarioCreationModal();
  await scenarioPage.setScenarioName(scenarioName);
  await scenarioPage.setScenarioInfraByName('small_infra');
  const createButton = playwrightHomePage.page.getByText('Créer le scénario');
  await createButton.click();
  await playwrightMap.page.waitForTimeout(2000);

  await scenarioPage.checkInfraLoaded();
  await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();

  await scenarioPage.setTrainScheduleName(trainScheduleName);
  await scenarioPage.setNumberOfTrains(trainCount);
  await scenarioPage.setDelta(delta);

  // ***************** Select Rolling Stock *****************
  const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
    playwrightHomePage.page
  );
  await playwrightRollingstockModalPage.openRollingstockModal();

  const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
    'rollingstock-rollingstock-1500-25000'
  );
  await rollingstockCard.click();
  await rollingstockCard.locator('button').click();

  // ***************** Select Origin/Destination *****************
  await scenarioPage.openTabByDataId('tab-pathfinding');
  await playwrightMap.page.waitForTimeout(2000);
  const itinerary = scenarioPage.getItineraryModule;
  await expect(itinerary).toBeVisible();
  await expect(scenarioPage.getMapModule).toBeVisible();

  // Search and select origin
  await playwrightMap.selectOrigin(originSearch);

  // Search and select destination
  await playwrightMap.selectDestination(destinationSearch);

  await scenarioPage.checkPathfindingDistance(pathfindingDistance);

  // ***************** Create train *****************
  await scenarioPage.addTrainSchedule();
  await scenarioPage.page.waitForSelector('.dots-loader', { state: 'hidden' });
  await scenarioPage.checkToastSNCFTitle();
  await scenarioPage.returnSimulationResult();
}

// API requests

const getApiContext = async () =>
  request.newContext({
    baseURL: 'http://localhost:4000',
  });

export const getApiRequest = async (
  url: string,
  params?: { [key: string]: string | number | boolean }
) => {
  const apiContext = await getApiContext();
  const response = await apiContext.get(url, { params });
  return response.json();
};

export const postApiRequest = async <T>(
  url: string,
  data?: T,
  params?: { [key: string]: string | number | boolean }
) => {
  const apiContext = await getApiContext();
  const newProject = await apiContext.post(url, { data, params });
  return newProject.json();
};

export const deleteApiRequest = async (url: string) => {
  const apiContext = await getApiContext();
  const deleteProject = apiContext.delete(url);
  return deleteProject;
};

// API calls for beforeAll setup in tests

export const findOneInResults = <T extends { name: string }>(results: T[], name: string) =>
  results.find((result) => result.name === name);

export const getInfra = async () => {
  const { results } = await getApiRequest(`/api/infra/`);
  const infra = findOneInResults(results, 'small_infra_test_e2e') as Infra;
  return infra;
};

export const getProject = async () => {
  const { results } = await getApiRequest(`/api/projects/`);
  const project = findOneInResults(results, 'project_test_e2e') as Project;
  return project;
};

export const getStudy = async (projectId: number) => {
  const { results } = await getApiRequest(`/api/projects/${projectId}/studies/`);
  const study = findOneInResults(results, 'study_test_e2e') as Study;
  return study;
};

export const getScenario = async (projectId: number, studyId: number) => {
  const { results } = await getApiRequest(
    `/api/projects/${projectId}/studies/${studyId}/scenarios/`
  );
  const scenario = findOneInResults(results, 'scenario_test_e2e') as Scenario;
  return scenario;
};

export const getRollingStock = async () => {
  const { results } = await getApiRequest(`/api/light_rolling_stock/`, { page_size: 500 });
  const rollingStock = findOneInResults(
    results,
    'rollingstock_1500_25000_test_e2e'
  ) as RollingStock;
  return rollingStock;
};
