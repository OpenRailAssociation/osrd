import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import { electricRollingStockName } from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import RouteTab from './pages/operational-studies/route-tab';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-setup';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';

test.describe('Route Tab Verification', () => {
  let operationalStudiesPage: OperationalStudiesPage;
  let rollingstockSelector: RollingStockSelector;
  let routeTab: RouteTab;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Set up the scenario', async () => {
    ({ project, study, scenario } = await createScenario());
    infra = await getInfra();
  });

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test.beforeEach(
    'Navigate to the scenario page and select the rolling stock before each test',
    async ({ page }) => {
      [operationalStudiesPage, rollingstockSelector, routeTab] = [
        new OperationalStudiesPage(page),
        new RollingStockSelector(page),
        new RouteTab(page),
      ];

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      // Wait for infra to be in 'CACHED' state before proceeding
      await waitForInfraStateToBeCached(infra.id);

      // Click on add train button and verify tab warnings
      await operationalStudiesPage.clickOnAddTrainButton();
      await operationalStudiesPage.verifyTabWarningPresence();

      // Select electric rolling stock and navigate to the Route Tab
      await rollingstockSelector.selectRollingStock(electricRollingStockName);
      await operationalStudiesPage.clickOnRouteTab();
    }
  );

  /** *************** Test 1 **************** */
  test('Select a route for operational study', async ({ browserName }) => {
    // Verify that no route is initially selected
    await routeTab.verifyNoSelectedRoute();

    // Perform pathfinding by station trigrams and verify map markers in Chromium
    await routeTab.performPathfindingByTrigram('WS', 'NES', 'MES');
    if (browserName === 'chromium') {
      const expectedMapMarkersValues = ['West_station', 'North_East_station', 'Mid_East_station'];
      await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Verify that tab warnings are absent
    await operationalStudiesPage.verifyTabWarningAbsence();
  });

  /** *************** Test 2 **************** */
  test('Adding waypoints to a route for operational study', async ({ browserName }) => {
    // Perform pathfinding by station trigrams
    await routeTab.performPathfindingByTrigram('WS', 'NES');

    // Define waypoints and add them to the route
    const expectedViaValues = [
      { name: 'Mid_West_station', ch: 'BV', uic: '3', km: 'KM 12.050' },
      { name: 'Mid_East_station', ch: 'BV', uic: '4', km: 'KM 26.500' },
    ];
    await routeTab.addNewWaypoints(2, ['Mid_West_station', 'Mid_East_station'], expectedViaValues);

    // Verify map markers in Chromium
    if (browserName === 'chromium') {
      const expectedMapMarkersValues = [
        'West_station',
        'Mid_West_station',
        'Mid_East_station',
        'North_East_station',
      ];
      await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Verify that tab warnings are absent
    await operationalStudiesPage.verifyTabWarningAbsence();
  });

  /** *************** Test 3 **************** */
  test('Reversing and deleting waypoints in a route for operational study', async ({
    browserName,
  }) => {
    // Perform pathfinding by station trigrams and verify map markers in Chromium
    await routeTab.performPathfindingByTrigram('WS', 'SES', 'MWS');
    const expectedMapMarkersValues = ['West_station', 'South_East_station', 'Mid_West_station'];
    if (browserName === 'chromium') {
      await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Reverse the itinerary and verify the map markers
    await routeTab.clickOnReverseItinerary();
    if (browserName === 'chromium') {
      const reversedMapMarkersValues = [...expectedMapMarkersValues].reverse();
      await routeTab.verifyMapMarkers(...reversedMapMarkersValues);
    }

    // Delete operational points and verify no selected route
    await routeTab.clickOnDeleteOPButtons();
    await routeTab.verifyNoSelectedRoute();

    // Perform pathfinding again and verify map markers in Chromium
    await routeTab.performPathfindingByTrigram('WS', 'SES', 'MWS');
    if (browserName === 'chromium') {
      await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Delete the itinerary and verify no selected route
    await routeTab.clickDeleteItineraryButton();
    await routeTab.verifyNoSelectedRoute();
  });
});
