import { type Page, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import { getInfra, getProject, getRollingStock, getStudy, postApiRequest } from '.';
import scenarioData from '../assets/operationStudies/scenario.json';
import HomePage from '../pages/home-page-model';
import RollingStockSelectorPage from '../pages/rollingstock-selector-page';
import ScenarioPage from '../pages/scenario-page-model';

// TODO : Check if this util can be reutilized in other tests
// Scenario creation
export default async function createCompleteScenario(
  page: Page,
  trainScheduleName: string,
  trainCount: string,
  delta: string
) {
  const smallInfra = await getInfra();
  const project = await getProject();
  const study = await getStudy(project.id);
  const rollingStock = await getRollingStock();

  const scenario = await postApiRequest(
    `/api/v2/projects/${project.id}/studies/${study.id}/scenarios`,
    {
      ...scenarioData,
      name: `${scenarioData.name} ${uuidv4()}`,
      study_id: study.id,
      infra_id: smallInfra.id,
    }
  );

  const homePage = new HomePage(page);
  const scenarioPage = new ScenarioPage(page);

  await page.goto(
    `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
  );

  await homePage.page.getByTestId('scenarios-add-train-schedule-button').click();

  await scenarioPage.setTrainScheduleName(trainScheduleName);
  await scenarioPage.setNumberOfTrains(trainCount);
  await scenarioPage.setDelta(delta);

  // ***************** Select Rolling Stock *****************
  const rollingstockModalPage = new RollingStockSelectorPage(homePage.page);
  await rollingstockModalPage.openRollingstockModal();

  await rollingstockModalPage.searchRollingstock('rollingstock_1500_25000_test_e2e');

  const rollingstockCard = rollingstockModalPage.getRollingstockCardByTestID(
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
  await scenarioPage.checkTrainHasBeenAdded();
  await scenarioPage.returnSimulationResult();
}

// Allowances management

export async function allowancesManagement(
  scenarioPage: ScenarioPage,
  scenarioName: string,
  allowanceType: 'standard' | 'engineering'
) {
  await expect(scenarioPage.getTimetableList).toBeVisible();

  await scenarioPage.getBtnByName(scenarioName).hover();
  await scenarioPage.page.getByTestId('edit-train').click();

  await scenarioPage.openAllowancesModule();
  await expect(scenarioPage.getAllowancesModule).toBeVisible();

  if (allowanceType === 'standard') {
    await scenarioPage.setStandardAllowance();
  } else {
    await scenarioPage.setEngineeringAllowance();
    await scenarioPage.clickSuccessBtn();
    await expect(scenarioPage.getAllowancesEngineeringSettings).toHaveAttribute('disabled');
  }

  await scenarioPage.page.getByTestId('submit-edit-train-schedule').click();
  await scenarioPage.page.waitForSelector('.scenario-details-name');
  expect(await scenarioPage.isAllowanceWorking()).toEqual(true);
}
