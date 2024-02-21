import { Page, request, expect } from '@playwright/test';
import type { Project, Scenario, Study, RollingStock, Infra } from 'common/api/osrdEditoastApi';
import { v4 as uuidv4 } from 'uuid';
import { PlaywrightHomePage } from '../pages/home-page-model';
import scenarioData from './operationStudies/scenario.json';

import RollingStockSelectorPage from '../pages/rolling-stock-selector-page';
import PlaywrightScenarioPage from '../pages/scenario-page-model';

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
  const response = await apiContext.post(url, { data, params });
  return response.json();
};

export const deleteApiRequest = async (url: string) => {
  const apiContext = await getApiContext();
  const response = apiContext.delete(url);
  return response;
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

// Scenario creation

export default async function createCompleteScenario(
  page: Page,
  trainScheduleName: string,
  trainCount: string,
  delta: string
) {
  const smallInfra = (await getInfra()) as Infra;
  const project = await getProject();
  const study = await getStudy(project.id);
  const rollingStock = await getRollingStock();

  const scenario = await postApiRequest(
    `/api/projects/${project.id}/studies/${study.id}/scenarios`,
    {
      ...scenarioData,
      name: `${scenarioData.name} ${uuidv4()}`,
      study_id: study.id,
      infra_id: smallInfra.id,
    }
  );

  const playwrightHomePage = new PlaywrightHomePage(page);
  const scenarioPage = new PlaywrightScenarioPage(page);

  await page.goto(
    `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
  );

  await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();

  await scenarioPage.setTrainScheduleName(trainScheduleName);
  await scenarioPage.setNumberOfTrains(trainCount);
  await scenarioPage.setDelta(delta);

  // ***************** Select Rolling Stock *****************
  const playwrightRollingstockModalPage = new RollingStockSelectorPage(playwrightHomePage.page);
  await playwrightRollingstockModalPage.openRollingstockModal();

  await playwrightRollingstockModalPage.searchRollingstock('rollingstock_1500_25000_test_e2e');

  const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
    `rollingstock-${rollingStock.name}`
  );

  await rollingstockCard.click();
  await rollingstockCard.locator('button').click();

  // ***************** Select Origin/Destination *****************
  await scenarioPage.openTabByDataId('tab-pathfinding');
  await scenarioPage.getPathfindingByTriGramSearch('MWS', 'NES');

  // ***************** Create train *****************
  await scenarioPage.addTrainSchedule();
  await scenarioPage.page.waitForSelector('.dots-loader', { state: 'hidden' });
  await scenarioPage.checkToastSNCFTitle();
  await scenarioPage.returnSimulationResult();
}

// Allowances management

export async function allowancesManagement(
  scenarioPage: PlaywrightScenarioPage,
  scenarioName: string,
  allowanceType: 'standard' | 'engineering'
) {
  expect(scenarioPage.getTimetableList).toBeVisible();

  await scenarioPage.getBtnByName(scenarioName).hover();
  await scenarioPage.page.getByTestId('edit-train').click();

  await scenarioPage.openAllowancesModule();
  expect(scenarioPage.getAllowancesModule).toBeVisible();

  if (allowanceType === 'standard') {
    await scenarioPage.setStandardAllowance();
  } else {
    await scenarioPage.setEngineeringAllowance();
    await scenarioPage.clickSuccessBtn();
    expect(scenarioPage.getAllowancesEngineeringSettings).toHaveAttribute('disabled');
  }

  await scenarioPage.page.getByTestId('submit-edit-train-schedule').click();
  await scenarioPage.page.waitForSelector('.scenario-details-name');
  expect(await scenarioPage.isAllowanceWorking()).toEqual(true);

  // TODO: check if the allowances are taken into account in the scenario page (waiting for issue # 6695 to be fixed)
}
