import { test, expect } from '@playwright/test';
import { PlaywrightHomePage } from './pages/home-page-model';
import PlaywrightRollingstockModalPage from './pages/rollingstock-modal-model';
import PlaywrightMap from './pages/map-model';
import VARIABLES from './assets/operationStudies/test_variables';
import PlaywrightScenarioPage from './pages/scenario-page-model';
import { ProjectPage } from './pages/project-page-model';
import { StudyPage } from './pages/study-page-model';

test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app', () => {
  let playwrightHomePage;
  let scenarioPage;
  let projectPage;
  let studyPage;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    playwrightHomePage = new PlaywrightHomePage(page);
    scenarioPage = new PlaywrightScenarioPage(page);
    projectPage = new ProjectPage(page);
    studyPage = new StudyPage(page);

    await playwrightHomePage.goToHomePage();

    // Real click on project, study, scenario
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId('_@Test integration project');
    await studyPage.openStudyByTestId('_@Test integration study');

    await scenarioPage.openScenarioCreationModal();
    await scenarioPage.setScenarioName('_@Test integration scenario created');
    await scenarioPage.setScenarioInfraByName(VARIABLES.infraName);
    const createButton = playwrightHomePage.page.getByText('Créer le scénario');
    await createButton.click();

    await scenarioPage.checkInfraLoaded();
    await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();

    await scenarioPage.setTrainScheduleName('Train Schedule 1');

    // ***************** Select Rolling Stock *****************
    const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
      playwrightHomePage.page
    );
    await playwrightRollingstockModalPage.openRollingstockModal();

    const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
      VARIABLES.rollingstockTestID
    );
    await rollingstockCard.click();

    await rollingstockCard.locator('button').click();

    // ***************** Select Origin/Destination *****************
    const playwrightMap = new PlaywrightMap(playwrightHomePage.page);
    await scenarioPage.openTabByText('Itinéraire');
    await playwrightMap.page.waitForTimeout(2000);
    const itinerary = scenarioPage.getItineraryModule;
    await expect(itinerary).toBeVisible();
    await expect(scenarioPage.getMapModule).toBeVisible();

    // Search and select origin
    await playwrightMap.selectOrigin(VARIABLES.originSearch);

    // Search and select destination
    await playwrightMap.selectDestination(VARIABLES.destinationSearch);

    await scenarioPage.checkPathfindingDistance(VARIABLES.pathfindingDistance);

    // ***************** Create train and edit it *****************

    await scenarioPage.addTrainSchedule();
    await scenarioPage.returnSimulationResult();
    await playwrightMap.page.waitForTimeout(2000);
  });

  // ***************** Test apply allowances *****************

  test('Testing allowances', async ({ page }) => {
    playwrightHomePage = new PlaywrightHomePage(page);
    scenarioPage = new PlaywrightScenarioPage(page);
    projectPage = new ProjectPage(page);
    studyPage = new StudyPage(page);

    await expect(scenarioPage.getTimetableList).toBeVisible();

    await scenarioPage.clickBtnByName('Afficher/masquer le détail des trains');

    await scenarioPage.getBtnByName(/Train Schedule 1/).hover();

    await scenarioPage.clickBtnByName('Modifier');

    await scenarioPage.openAllowancesModule();
    await expect(scenarioPage.getAllowancesModule).toBeVisible();

    // Add and check standard allowance
    await scenarioPage.setStandardAllowance();
    await scenarioPage.clickBtnByName('Modifier le train');

    expect(await scenarioPage.isAllowanceWorking()).toEqual(true);

    await scenarioPage.getBtnByName(/Train Schedule 1/).hover();
    await scenarioPage.clickBtnByName('Modifier');
    await scenarioPage.openAllowancesModule();
    await expect(scenarioPage.getAllowancesModule).toBeVisible();

    // Add and check engineering allowance
    await scenarioPage.setEngineeringAllowance();
    await scenarioPage.clickSuccessBtn();
    expect(scenarioPage.checkAllowanceEngineeringBtn());
    await scenarioPage.clickBtnByName('Modifier le train');
    await scenarioPage.page.waitForSelector('.scenario-details-name');

    expect(await scenarioPage.isAllowanceWorking()).toEqual(true);
  });

  // ***************** Deleting train *****************

  test.afterEach(async ({ page }) => {
    scenarioPage = new PlaywrightScenarioPage(page);
    await scenarioPage.getBtnByName(/Train Schedule 1/).hover();
    await scenarioPage.page.getByRole('button', { name: 'Supprimer' }).click();
  });
});
