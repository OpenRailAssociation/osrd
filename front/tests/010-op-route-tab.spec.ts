import type { Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import HomePage from './pages/home-page-model';
import RoutePage from './pages/op-route-page-model';
import OperationalStudiesPage from './pages/operational-studies-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page-model';
import test from './test-logger';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';

test.describe('Route Tab Verification', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let OSRDLanguage: string;
  const electricRollingStockName = 'electric_rolling_stock_test_e2e';

  test.beforeAll('Set up the scenario', async () => {
    ({ project, study, scenario } = await createScenario());
  });

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test.beforeEach(
    'Navigate to the scenario page and select the rolling stock before each test',
    async ({ page }) => {
      const [operationalStudiesPage, rollingstockSelectorPage, homePage] = [
        new OperationalStudiesPage(page),
        new RollingStockSelectorPage(page),
        new HomePage(page),
      ];

      await homePage.goToHomePage();
      OSRDLanguage = await homePage.getOSRDLanguage();

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      // Verify that the infrastructure is correctly loaded
      await operationalStudiesPage.checkInfraLoaded();

      // Click on add train button and verify tab warnings
      await operationalStudiesPage.clickOnAddTrainButton();
      await operationalStudiesPage.verifyTabWarningPresence();

      // Select electric rolling stock and navigate to the Route Tab
      await rollingstockSelectorPage.selectRollingStock(electricRollingStockName);
      await operationalStudiesPage.clickOnRouteTab();
    }
  );

  /** *************** Test 1 **************** */
  test('Select a route for operational study', async ({ page, browserName }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const routePage = new RoutePage(page);

    // Verify that no route is initially selected
    await routePage.verifyNoSelectedRoute(OSRDLanguage);

    // Perform pathfinding by station trigrams and verify map markers in Chromium
    await routePage.performPathfindingByTrigram('WS', 'NES', 'MES');
    if (browserName === 'chromium') {
      const expectedMapMarkersValues = ['West_station', 'North_East_station', 'Mid_East_station'];
      await routePage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Verify that tab warnings are absent
    await operationalStudiesPage.verifyTabWarningAbsence();
  });

  /** *************** Test 2 **************** */
  test('Adding waypoints to a route for operational study', async ({ page, browserName }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const routePage = new RoutePage(page);

    // Perform pathfinding by station trigrams
    await routePage.performPathfindingByTrigram('WS', 'NES');

    // Define waypoints and add them to the route
    const expectedViaValues = [
      { name: 'Mid_West_station', ch: 'BV', uic: '3', km: 'KM 11.850' },
      { name: 'Mid_East_station', ch: 'BV', uic: '4', km: 'KM 26.300' },
    ];
    await routePage.addNewWaypoints(2, ['Mid_West_station', 'Mid_East_station'], expectedViaValues);

    // Verify map markers in Chromium
    if (browserName === 'chromium') {
      const expectedMapMarkersValues = [
        'West_station',
        'Mid_West_station',
        'Mid_East_station',
        'North_East_station',
      ];
      await routePage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Verify that tab warnings are absent
    await operationalStudiesPage.verifyTabWarningAbsence();
  });

  /** *************** Test 3 **************** */
  test('Reversing and deleting waypoints in a route for operational study', async ({
    page,
    browserName,
  }) => {
    test.slow(browserName === 'webkit', 'This test is slow on Safari');

    const routePage = new RoutePage(page);

    // Perform pathfinding by station trigrams and verify map markers in Chromium
    await routePage.performPathfindingByTrigram('WS', 'SES', 'MWS');
    const expectedMapMarkersValues = ['West_station', 'South_East_station', 'Mid_West_station'];
    if (browserName === 'chromium') {
      await routePage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Reverse the itinerary and verify the map markers
    await routePage.clickOnReverseItinerary();
    if (browserName === 'chromium') {
      const reversedMapMarkersValues = [...expectedMapMarkersValues].reverse();
      await routePage.verifyMapMarkers(...reversedMapMarkersValues);
    }

    // Delete operational points and verify no selected route
    await routePage.clickOnDeleteOPButtons(OSRDLanguage);
    await routePage.verifyNoSelectedRoute(OSRDLanguage);

    // Perform pathfinding again and verify map markers in Chromium
    await routePage.performPathfindingByTrigram('WS', 'SES', 'MWS');
    if (browserName === 'chromium') {
      await routePage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Delete the itinerary and verify no selected route
    await routePage.clickDeleteItineraryButton();
    await routePage.verifyNoSelectedRoute(OSRDLanguage);
  });
});
