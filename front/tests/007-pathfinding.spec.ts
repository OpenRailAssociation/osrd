import { test } from '@playwright/test';
import { PlaywrightHomePage } from './pages/home-page-model';
import PlaywrightRollingstockModalPage from './pages/rollingstock-modal-model';
import PlaywrightMap from './pages/map-model';
import VARIABLES from './assets/operationStudies/test_variables';
import PlaywrightScenarioPage from './pages/scenario-page-model';

test.describe('Testing pathfinding', () => {
  test('Test pathfinding: no electrified rolling stock for this path throws error', async ({
    page,
  }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const scenarioPage = new PlaywrightScenarioPage(page);

    await playwrightHomePage.goToHomePage();

    // Real click on project, study, scenario
    await playwrightHomePage.goToOperationalStudiesPage();
    await playwrightHomePage.page
      .getByTestId('_@Test integration project')
      .locator('div')
      .getByRole('button')
      .click();

    await playwrightHomePage.page
      .getByTestId('_@Test integration study')
      .getByRole('button')
      .click();

    // Create scenario with infra France
    await scenarioPage.openScenarioCreationModal();
    await scenarioPage.setScenarioName('_@Test integration scenario created local');
    await scenarioPage.setScenarioInfraByName(VARIABLES.infraName);
    const createButton = playwrightHomePage.page.getByText('Créer le scénario');
    await createButton.click();

    await scenarioPage.checkInfraLoaded();
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

    // ***************** Choice Origin/Destination *****************
    const playwrightMap = new PlaywrightMap(playwrightHomePage.page);
    await scenarioPage.openTabByText('Itinéraire');

    // Search and select origin
    await playwrightMap.selectOrigin(VARIABLES.originSearchQuimper || VARIABLES.originSearch);

    // Search and select destination
    await playwrightMap.selectDestination(
      VARIABLES.destinationSearchBrest || VARIABLES.destinationSearch
    );

    await scenarioPage.checkPathfingingStateText(
      'Erreur dans la recherche d’itinéraire : Aucun itinéraire trouvé pour un matériel avec ce type d’électrification.'
    );
  });
});
