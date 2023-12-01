import { test } from './baseFixtures';
import { PlaywrightHomePage } from './pages/home-page-model';
import { ProjectPage } from './pages/project-page-model';
import { StudyPage } from './pages/study-page-model';
import PlaywrightRollingstockModalPage from './pages/rollingstock-modal-model';
import PlaywrightMap from './pages/map-model';
import VARIABLES from './assets/operationStudies/testVariables';
import PATH_VARIABLES from './assets/operationStudies/testVariablesPaths';
import PlaywrightScenarioPage from './pages/scenario-page-model';

test.skip('Testing pathfinding', () => {
  let playwrightHomePage: PlaywrightHomePage;
  let projectPage: ProjectPage;
  let studyPage: StudyPage;
  let scenarioPage: PlaywrightScenarioPage;
  let playwrightMap: PlaywrightMap;
  let isScenarioCreated = false;

  test.beforeEach(async ({ page }) => {
    playwrightHomePage = new PlaywrightHomePage(page);
    projectPage = new ProjectPage(page);
    studyPage = new StudyPage(page);
    scenarioPage = new PlaywrightScenarioPage(page);
    playwrightMap = new PlaywrightMap(page);

    await playwrightHomePage.goToHomePage();

    // Click on project, study
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId('_@Test integration project');
    await studyPage.openStudyByTestId('_@Test integration study');

    // Create scenario with infra France
    if (!isScenarioCreated) {
      await scenarioPage.openScenarioCreationModal();
      await scenarioPage.setScenarioName(
        '_@Test integration scenario created for test pathfinding'
      );
      await scenarioPage.setScenarioInfraByName(VARIABLES.infraName);
      const createButton = playwrightHomePage.page.getByText('Créer le scénario');
      await createButton.click();

      await scenarioPage.checkInfraLoaded();

      isScenarioCreated = true;
    } else {
      await scenarioPage.openScenarioByTestId(
        '_@Test integration scenario created for test pathfinding'
      );
    }

    await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();

    // ***************** Rolling Stock *****************
    const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
      playwrightHomePage.page
    );

    await playwrightRollingstockModalPage.openRollingstockModal();
    await playwrightRollingstockModalPage.searchRollingstock(
      VARIABLES.searchRollingstock1500V || VARIABLES.searchRollingstock
    );
    const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
      VARIABLES.rollingstockTestID1500V || VARIABLES.rollingstockTestID
    );
    await rollingstockCard.click();
    await rollingstockCard.locator('button').click();

    // ***************** Composition Code *****************
    await scenarioPage.openTabByText('Paramètres de simulation');
    await scenarioPage.getSpeedLimitSelector.click();
    await scenarioPage.getSpeedLimitSelector.locator('input').fill('Haut');
    await scenarioPage.getSpeedLimitSelector.getByRole('button', { name: 'Haut le pied' }).click();

    await scenarioPage.openTabByText('Itinéraire');
  });

  test('Test pathfinding: no electrified rolling stock for this path throws error', async () => {
    await scenarioPage.setTrainScheduleName('TrainSchedule electrification error');
    // ***************** Choice Origin/Destination *****************

    // Search and select origin
    await playwrightMap.selectOrigin(
      PATH_VARIABLES.originSearchQuimper || PATH_VARIABLES.originSearch
    );

    // Search and select destination
    await playwrightMap.selectDestination(
      PATH_VARIABLES.destinationSearchBrest || PATH_VARIABLES.destinationSearch
    );

    await scenarioPage.checkPathfingingStateText(
      'Erreur dans la recherche d’itinéraire : Aucun itinéraire trouvé pour un matériel avec ce type d’électrification.'
    );
  });

  test('Test pathfinding: missing origin throws error', async () => {
    await scenarioPage.setTrainScheduleName('TrainSchedule missing origin');
    // ***************** Choice Destination *****************
    // Search and select destination
    await playwrightMap.selectDestination(
      PATH_VARIABLES.destinationSearchBrest || PATH_VARIABLES.destinationSearch
    );

    await scenarioPage.addTrainSchedule();
    await scenarioPage.checkPathfingingStateText('Éléments manquants pour la recherche : Origine.');
    await scenarioPage.checkToastSNCFBody("L'origine n'est pas définie");
  });

  test('Test pathfinding: missing destination throws error', async () => {
    await scenarioPage.setTrainScheduleName('TrainSchedule missing destination');
    // ***************** Choice Origin *****************
    // Search and select origin
    await playwrightMap.selectOrigin(
      PATH_VARIABLES.originSearchQuimper || PATH_VARIABLES.originSearch
    );

    await scenarioPage.addTrainSchedule();
    await scenarioPage.checkPathfingingStateText(
      'Éléments manquants pour la recherche : Destination.'
    );
    await scenarioPage.checkToastSNCFBody("La destination n'est pas définie");
  });
});
