import { test } from '@playwright/test';
import { PlaywrightHomePage } from './home-page-model';
import PlaywrightRollingstockModalPage from './rollingstock-modal-model';
import PlaywrightMap from './map-model';
import VARIABLES from './assets/operationStudies/test_variables';
import PlaywrightScenarioPage from './scenario-page-model';

if (!process.env.CI) {
  test.describe('Testing pathfinding in a local environment', () => {
    let playwrightHomePage: PlaywrightHomePage;
    let playwrightScenarioPage: PlaywrightScenarioPage;

    test.beforeEach(async ({ page }) => {
      playwrightHomePage = new PlaywrightHomePage(page);
      playwrightScenarioPage = new PlaywrightScenarioPage(page);

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

      await playwrightHomePage.page
        .getByTestId('_@Test integration scenario')
        .getByRole('button')
        .click();
      await playwrightScenarioPage.checkInfraLoaded();
      await playwrightHomePage.page.getByTestId('scenarios-add-train-schedule-button').click();
    });

    test('Test pathfinding: no electrified rolling stock for this path throws error', async () => {
      // ***************** Rolling Stock *****************
      const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
        playwrightHomePage.page
      );

      await playwrightRollingstockModalPage.openRollingstockModal();
      await playwrightRollingstockModalPage.searchRollingstock(VARIABLES.searchRollingstock);
      const rollingstockCard = playwrightRollingstockModalPage.getRollingstockCardByTestID(
        VARIABLES.rollingstockTestID
      );
      await rollingstockCard.click();
      await rollingstockCard.locator('button').click();

      // ***************** Composition Code *****************
      await playwrightScenarioPage.openTabByText('Paramètres de simulation');
      await playwrightScenarioPage.getSpeedLimitSelector.click();
      await playwrightScenarioPage.getSpeedLimitSelector.locator('input').fill('Haut');
      await playwrightScenarioPage.getSpeedLimitSelector
        .getByRole('button', { name: 'Haut le pied' })
        .click();

      // ***************** Choice Origin/Destination *****************
      const playwrightMap = new PlaywrightMap(playwrightHomePage.page);
      await playwrightScenarioPage.openTabByText('Itinéraire');

      // Search and select origin
      await playwrightMap.openMapSearch();
      await playwrightMap.searchStation('quimper');
      await playwrightHomePage.page.getByRole('button', { name: 'QR Quimper SP 87474098' }).click();
      await playwrightMap.closeMapSearch();
      await playwrightMap.addTimeoutForMapToLoad(100);
      await playwrightMap.clickOnMap({ x: 230, y: 165 });
      await playwrightMap.clickOnOrigin();

      // Search and select destination
      await playwrightMap.openMapSearch();
      await playwrightMap.searchStation('brest');
      await playwrightHomePage.page.getByRole('button', { name: 'BT Brest 87474007' }).click();
      await playwrightMap.closeMapSearch();
      await playwrightMap.addTimeoutForMapToLoad(100);
      await playwrightMap.clickOnMap({ x: 230, y: 165 });
      await playwrightMap.clickOnDestination();
      await playwrightScenarioPage.checkPathfingingStateText(
        'Erreur dans la recherche d’itinéraire : Aucun itinéraire trouvé pour un matériel avec ce type d’électrification.'
      );
    });
  });
}
