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
import OperationalStudiesPage from './pages/operational-studies-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page';
import ScenarioPage from './pages/scenario-page-model';
import { getProject, getStudy, getRollingStock, postApiRequest, getInfra } from './utils/index';

let smallInfra: Infra;
let project: Project;
let study: Study;
let scenario: Scenario;
let rollingStock: RollingStock;
let timetable: Timetable;

const dualModeRollingStockName = 'dual-mode_rollingstock_test_e2e';
const electricRollingStockName = 'rollingstock_1500_25000_test_e2e';
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
  scenario = await postApiRequest(`/api/v2/projects/${project.id}/studies/${study.id}/scenarios/`, {
    ...scenarioData,
    name: `${scenarioData.name} ${uuidv4()}`,
    study_id: study.id,
    infra_id: smallInfra.id,
    timetable_id: timetable.id,
  });
});

test.describe('Verifying that all elements in the rolling stock tab are loaded correctly', () => {
  test('should correctly select a rolling stock for operational study', async ({ page }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const scenarioPage = new ScenarioPage(page);
    const rollingStockSelector = new RollingStockSelectorPage(page);

    // TODO: DROP TSV1: remove this part
    const homePage = new HomePage(page);
    await homePage.goToHomePage();
    await homePage.toggleTSV2();

    // Navigate to the created scenario page
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    // Verify that the infrastructure is correctly loaded
    await scenarioPage.checkInfraLoaded();

    // Click on add train button
    await operationalStudiesPage.clickOnAddTrainBtn();

    // Verify the presence of warnings in Rolling Stock and Route Tab
    await operationalStudiesPage.verifyTabWarningPresence();

    // Open Rolling Stock Selector and search for the added train
    await operationalStudiesPage.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(dualModeRollingStockName);
    const rollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${dualModeRollingStockName}`
    );

    // Verify that the rolling stock card is inactive
    await expect(rollingstockCard).toHaveClass(/inactive/);

    // Verify that the rolling stock card is active after clicking on it
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    // Select the comfort AC
    const comfortACRadioText = await rollingStockSelector.comfortACButton.innerText();
    await rollingStockSelector.comfortACButton.click();

    // Select the rolling stock
    await rollingstockCard.locator('button').click();

    // Verify that the correct comfort type is displayed
    const selectedComfortACText = await rollingStockSelector.getSelectedComfortType.innerText();
    expect(selectedComfortACText).toMatch(new RegExp(comfortACRadioText, 'i'));
  });

  test('should correctly modify a rolling stock for operational study', async ({ page }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const scenarioPage = new ScenarioPage(page);
    const rollingStockSelector = new RollingStockSelectorPage(page);

    // TODO: DROP TSV1: remove this part
    const homePage = new HomePage(page);
    await homePage.goToHomePage();
    await homePage.toggleTSV2();

    // Navigate to the created scenario page
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    // Verify that the infrastructure is correctly loaded
    await scenarioPage.checkInfraLoaded();

    // Click on add train button
    await operationalStudiesPage.clickOnAddTrainBtn();

    // Open Rolling Stock Selector, search for the added train, and select it
    await operationalStudiesPage.openEmptyRollingStockSelector();
    await rollingStockSelector.searchRollingstock(electricRollingStockName);
    const fastRollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${rollingStock.name}`
    );
    await fastRollingstockCard.click();
    await fastRollingstockCard.locator('button').click();
    expect(await rollingStockSelector.getSelectedRollingStockName.innerText()).toEqual(
      electricRollingStockName
    );

    // Reopen the Rolling Stock selector from the selected card
    await operationalStudiesPage.openRollingStockSelector();

    // Apply thermal and electrical filters
    await rollingStockSelector.thermalRollingStockFilter();
    await rollingStockSelector.electricRollingStockFilter();

    // Select the dual mode rolling stock
    const dualModeRollingstockCard = rollingStockSelector.getRollingstockCardByTestID(
      `rollingstock-${dualModeRollingStockName}`
    );
    await dualModeRollingstockCard.click();
    await dualModeRollingstockCard.locator('button').click();

    // Verify that the correct rolling stock name is displayed
    expect(await rollingStockSelector.getSelectedRollingStockName.innerText()).toEqual(
      dualModeRollingStockName
    );
  });
});
