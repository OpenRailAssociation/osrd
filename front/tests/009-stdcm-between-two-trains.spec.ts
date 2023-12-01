import { test } from './baseFixtures';
import { PlaywrightHomePage } from './pages/home-page-model';
import PlaywrightRollingstockModalPage from './pages/rollingstock-modal-model';
import { PlaywrightSTDCMPage } from './pages/stdcm-page-model';
import PlaywrightMap from './pages/map-model';
import VARIABLES from './assets/operationStudies/testVariables';
import PATH_VARIABLES from './assets/operationStudies/testVariablesPaths';
import PlaywrightScenarioPage from './pages/scenario-page-model';
import createCompleteScenario from './assets/utils';

const pathfindingDistance = VARIABLES.stdcm
  ? VARIABLES.stdcm.pathfindingDistance
  : VARIABLES.pathfindingDistance;

// TODO: find out how we manage VARIABLES.rollingstockTestID with the new setup excluding infra France
//
// const rollingStockTestID = VARIABLES.stdcm.rollingstockTestID
//   ? VARIABLES.stdcm.rollingstockTestID
//   : VARIABLES.rollingstockTestID;

const rollingStockTestID = VARIABLES.rollingstockTestID
  ? VARIABLES.rollingstockTestID
  : VARIABLES.rollingstockTestID;

const originSearch = PATH_VARIABLES.stdcm
  ? PATH_VARIABLES.stdcm.originSearchDijon || PATH_VARIABLES.stdcm.originSearch
  : PATH_VARIABLES.originSearch;

const destinationSearch = PATH_VARIABLES.stdcm
  ? PATH_VARIABLES.stdcm.destinationSearchMacon || PATH_VARIABLES.stdcm.destinationSearch
  : PATH_VARIABLES.destinationSearch;

const scenarioName = process.env.CI
  ? '_@Test integration scenario'
  : '_@Test integration stdcm scenario';

test.skip('Testing if stdcm between two trains works well', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000); // 3min
    // if test in local, create our own scenario with France infra
    // else, use the default scenario
    if (!process.env.CI) {
      await createCompleteScenario(
        page,
        scenarioName,
        'Test STDCM',
        '2',
        '60',
        PATH_VARIABLES.originSearchDijon || PATH_VARIABLES.originSearch,
        PATH_VARIABLES.destinationSearchMacon || PATH_VARIABLES.destinationSearch,
        pathfindingDistance
      );
    }
  });

  // ***************** Test STDCM *****************
  test('Testing stdcm', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const scenarioPage = new PlaywrightScenarioPage(page);
    const playwrightSTDCMPage = new PlaywrightSTDCMPage(page);

    await playwrightHomePage.goToHomePage();

    await playwrightHomePage.goToSTDCMPage();
    await playwrightSTDCMPage.getScenarioExploratorModalClose();
    await playwrightSTDCMPage.openScenarioExplorator();
    await playwrightSTDCMPage.getScenarioExploratorModalOpen();
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('_@Test integration project');
    await playwrightSTDCMPage.clickItemScenarioExploratorByName('_@Test integration study');
    await playwrightSTDCMPage.clickItemScenarioExploratorByName(scenarioName);

    // ***************** Select Rolling Stock *****************
    const playwrightRollingstockModalPage = new PlaywrightRollingstockModalPage(
      playwrightHomePage.page
    );
    await playwrightRollingstockModalPage.openRollingstockModal();
    const rollingstockCard =
      playwrightRollingstockModalPage.getRollingstockCardByTestID(rollingStockTestID);
    await rollingstockCard.click();
    await rollingstockCard.locator('button').click();

    // ***************** Select Origin/Destination *****************
    const playwrightMap = new PlaywrightMap(playwrightHomePage.page);

    await playwrightMap.selectOrigin(originSearch);

    await playwrightMap.selectDestination(destinationSearch);

    await scenarioPage.checkPathfindingDistance(pathfindingDistance);

    const originTime = '081500';
    await playwrightSTDCMPage.setOriginTime(originTime);
    await scenarioPage.clickBtnByName('Appliquer');
    await scenarioPage.page.waitForSelector('.chart-container');
  });
});
