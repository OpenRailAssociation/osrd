import { test, expect } from './baseFixtures';
import { PlaywrightHomePage } from './pages/home-page-model';
import PlaywrightRollingstockModalPage from './pages/rollingstock-modal-model';
import PlaywrightMap from './pages/map-model';
import VARIABLES from './assets/operationStudies/testVariables';
import PATH_VARIABLES from './assets/operationStudies/testVariablesPaths';
import PlaywrightScenarioPage from './pages/scenario-page-model';
import { ProjectPage } from './pages/project-page-model';
import { StudyPage } from './pages/study-page-model';

test.describe('Testing if all mandatory elements simulation configuration are loaded in operationnal studies app', () => {
  test('Testing pathfinding with rollingstock an composition code', async ({ page }) => {
    test.setTimeout(90000); // 1min30
    const playwrightHomePage = new PlaywrightHomePage(page);
    const scenarioPage = new PlaywrightScenarioPage(page);
    const projectPage = new ProjectPage(page);
    const studyPage = new StudyPage(page);

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

    await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
      VARIABLES.numberOfRollingstock
    );

    await playwrightRollingstockModalPage.getElectricalCheckbox.click();
    await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
      VARIABLES.numberOfRollingstockWithElectrical
    );

    await playwrightRollingstockModalPage.searchRollingstock(VARIABLES.searchRollingstock);
    await playwrightRollingstockModalPage.checkNumberOfRollingstockFound(
      VARIABLES.numberOfRollingstockWithSearch
    );

    const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
      VARIABLES.rollingstockTestID
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
    await scenarioPage.openTabByText('Paramètres de simulation');
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
    await scenarioPage.openTabByText('Itinéraire');
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
    await scenarioPage.checkToastSNCFTitle('Train ajouté');
    await scenarioPage.returnSimulationResult();
    await scenarioPage.checkNumberOfTrains(Number(trainCount));

    // Delete all trains when the selection of multiple trains has been added
  });
});
