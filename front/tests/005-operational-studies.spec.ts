import { expect } from '@playwright/test';

import type {
  Infra,
  LightRollingStock,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import { NEW_PACED_TRAIN_SETTINGS } from './assets/constants/operational-studies-const';
import {
  dualModeRollingStockName,
  electricRollingStockName,
} from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import RouteTab from './pages/operational-studies/route-tab';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra, getRollingStock } from './utils/api-setup';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import type { ManageTrainScheduleTranslations } from './utils/types';

const enTranslations: ManageTrainScheduleTranslations = readJsonFile(
  'public/locales/en/operationalStudies/manageTrainSchedule.json'
);
const frTranslations: ManageTrainScheduleTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/manageTrainSchedule.json'
);

test.describe('Verify simulation configuration in operational studies for train schedules and paced trains', () => {
  test.slow();

  let rollingstockSelector: RollingStockSelector;
  let operationalStudiesPage: OperationalStudiesPage;
  let routeTab: RouteTab;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;
  let rollingStock: LightRollingStock;
  let translations: ManageTrainScheduleTranslations;

  test.beforeAll('Fetch infrastructure and get translations', async () => {
    rollingStock = await getRollingStock(electricRollingStockName);
    infra = await getInfra();
    translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
  });

  test.beforeEach('Set up the project, study, and scenario', async ({ page }) => {
    [rollingstockSelector, operationalStudiesPage, routeTab] = [
      new RollingStockSelector(page),
      new OperationalStudiesPage(page),
      new RouteTab(page),
    ];

    ({ project, study, scenario } = await createScenario());
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  /** *************** Test **************** */
  test('Add a paced train', async ({ page }) => {
    // Navigate to the scenario page for the given project and study
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    await operationalStudiesPage.checkPacedTrainSwitch();

    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);

    // Click the button to add a train schedule or paced train
    await operationalStudiesPage.clickOnAddTrainButton();

    // Verify that all configuration buttons and inputs are visible and have their proper default values
    await operationalStudiesPage.checkInputsAndButtons(translations, scenario.creation_date);

    // Verify that all tabs are visible and their default behavior is correct
    await operationalStudiesPage.checkTabs();

    // Check the define paced train checkbox
    await operationalStudiesPage.checkPacedTrainModeAndVerifyInputs(translations);

    // Test the paced train mode behavior
    await operationalStudiesPage.testPacedTrainMode(translations);

    // Set the paced train inputs
    await operationalStudiesPage.fillPacedTrainSettings(NEW_PACED_TRAIN_SETTINGS);

    // Select a rolling stock
    await rollingstockSelector.selectRollingStock(dualModeRollingStockName);

    // Select an itinerary
    await operationalStudiesPage.clickOnRouteTab();
    await routeTab.performPathfindingByTrigram('MWS', 'NES');
    await operationalStudiesPage.checkPathfindingDistance('33.950 km');

    // TODO : update this part when paced train endpoints are delivered to find a fine configuration for it
    // Change some time and stops

    // Adding Train Schedule
    await operationalStudiesPage.addTrainSchedule();

    // TODO : update the test to verify the newly added paced train (for now nothing happens when clicking on the button)
  });

  // TODO Paced train : Remove this test in https://github.com/OpenRailAssociation/osrd/issues/10791
  test('Pathfinding with rolling stock and composition code', async ({ page }) => {
    // Page models

    // Navigate to the scenario page for the given project and study
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);

    // Click the button to add a train schedule
    await operationalStudiesPage.clickOnAddTrainButton();

    // Set the train schedule name and number of trains
    await operationalStudiesPage.setTrainScheduleName('TrainSchedule');
    await operationalStudiesPage.setNumberOfTrains('7');

    // Open the rolling stock modal

    await rollingstockSelector.openRollingstockModal();
    await expect(rollingstockSelector.rollingStockSelectorModal).toBeVisible();

    // Test rolling stock search with normalization (spaces and capital letters)
    await rollingstockSelector.searchRollingstock(' electric_Rs_E2e ');

    // Select the rolling stock card based on the test ID
    const rollingstockCard = rollingstockSelector.getRollingstockCardByTestID(
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
    expect(await rollingstockSelector.getRollingStockMiniCardInfo().first().textContent()).toMatch(
      rollingStock.name
    );
    expect(await rollingstockSelector.getRollingStockInfoComfort().textContent()).toMatch(
      /ConfortSStandard/i
    );

    // Perform Pathfinding and verify the distance
    await operationalStudiesPage.clickOnRouteTab();
    await routeTab.performPathfindingByTrigram('MWS', 'NES');
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
