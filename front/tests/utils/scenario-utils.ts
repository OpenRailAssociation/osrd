import { type Page, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import scenarioData from '../assets/operationStudies/scenario.json';
import { getInfra, getProject, getRollingStock, getStudy, postApiRequest } from '.';
import { PlaywrightHomePage } from '../pages/home-page-model';
import RollingStockSelectorPage from '../pages/rolling-stock-selector-page';
import PlaywrightScenarioPage from '../pages/scenario-page-model';

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
  await scenarioPage.checkTrainHasBeenAdded();
  await scenarioPage.returnSimulationResult();
}

// Allowances management

export async function allowancesManagement(
  scenarioPage: PlaywrightScenarioPage,
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
