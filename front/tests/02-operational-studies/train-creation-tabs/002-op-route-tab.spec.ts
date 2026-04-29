import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import { electricRollingStockName } from '../../assets/constants/project-const';
import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra } from '../../utils/api-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';

test.describe('Route tab', { tag: ['@op', '@route-tab'] }, () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Set up the scenario', async () => {
    ({ project, study, scenario } = await createScenario());
    infra = await getInfra();
  });

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  test.beforeEach(async ({ page, operationalStudiesPage, rollingStockSelector }) => {
    await test.step('Open scenario, wait infra cache, open form and verify tab warnings', async () => {
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
      await operationalStudiesPage.openTrainScheduleForm();
      await operationalStudiesPage.verifyTabWarningPresence();
    });

    await test.step('Select rolling stock and open the Route tab', async () => {
      await rollingStockSelector.selectRollingStock(electricRollingStockName);
      await operationalStudiesPage.openRouteTab();
    });
  });

  /** *************** Test 1 **************** */
  test(
    'Select a route for operational study',
    { tag: '@smoke' },
    async ({ browserName, routeTab, operationalStudiesPage }) => {
      await test.step('Verify no route selected initially', async () => {
        await routeTab.verifyNoSelectedRoute();
      });

      await test.step('Perform pathfinding by trigrams (WS → NES via MES)', async () => {
        await routeTab.performPathfindingByTrigram({
          originTrigram: 'WS',
          destinationTrigram: 'NES',
          viaTrigram: 'MES',
        });
      });

      await test.step('Verify map markers (Chromium only)', async () => {
        if (browserName === 'chromium') {
          const expectedMapMarkersValues = [
            'West_station',
            'North_East_station',
            'Mid_East_station',
          ];
          await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
        }
      });

      await test.step('Verify tab warnings are absent', async () => {
        await operationalStudiesPage.verifyTabWarningAbsence();
      });
    }
  );

  /** *************** Test 2 **************** */
  test('Adding waypoints to a route for operational study', async ({
    browserName,
    routeTab,
    operationalStudiesPage,
  }) => {
    await test.step('Perform pathfinding by trigrams (WS → NES)', async () => {
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'NES',
      });
    });

    await test.step('Add two waypoints and verify via list', async () => {
      const expectedViaValues = [
        { name: 'Mid_West_station', ch: 'BV', uic: '33', km: 'KM 12.050' },
        { name: 'Mid_East_station', ch: 'BV', uic: '44', km: 'KM 26.500' },
      ];
      await routeTab.addNewWaypoints(
        2,
        ['Mid_West_station', 'Mid_East_station'],
        expectedViaValues
      );
    });

    await test.step('Verify map markers (Chromium only)', async () => {
      if (browserName === 'chromium') {
        const expectedMapMarkersValues = [
          'West_station',
          'Mid_West_station',
          'Mid_East_station',
          'North_East_station',
        ];
        await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
      }
    });

    await test.step('Verify tab warnings are absent', async () => {
      await operationalStudiesPage.verifyTabWarningAbsence();
    });
  });

  /** *************** Test 3 **************** */
  test('Reversing and deleting waypoints', async ({ browserName, routeTab }) => {
    const expectedMapMarkersValues = ['West_station', 'South_East_station', 'Mid_West_station'];

    await test.step('Perform pathfinding WS → SES via MWS and verify markers', async () => {
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'SES',
        viaTrigram: 'MWS',
      });

      if (browserName === 'chromium') {
        await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
      }
    });

    await test.step('Reverse itinerary and verify markers (Chromium only)', async () => {
      await routeTab.reverseItinerary();
      if (browserName === 'chromium') {
        const reversedMapMarkersValues = [...expectedMapMarkersValues].reverse();
        await routeTab.verifyMapMarkers(...reversedMapMarkersValues);
      }
    });

    await test.step('Delete operation points and verify no selected route', async () => {
      await routeTab.deleteOperationPoints();
      await routeTab.verifyNoSelectedRoute();
    });

    await test.step('Perform pathfinding again and verify markers (Chromium only)', async () => {
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'SES',
        viaTrigram: 'MWS',
      });
      if (browserName === 'chromium') {
        await routeTab.verifyMapMarkers(...expectedMapMarkersValues);
      }
    });

    await test.step('Delete itinerary and verify no selected route', async () => {
      await routeTab.deleteItinerary();
      await routeTab.verifyNoSelectedRoute();
    });
  });
});
