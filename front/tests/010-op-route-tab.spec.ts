import { test } from '@playwright/test';

import type { Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import HomePage from './pages/home-page-model';
import OperationalStudiesPage from './pages/operational-studies-page-model';
import ScenarioPage from './pages/scenario-page-model';
import setupScenario from './utils/scenario';

let project: Project;
let study: Study;
let scenario: Scenario;
let selectedLanguage: string;

const electricRollingStockName = 'electric_rolling_stock_test_e2e';

test.beforeAll(async () => {
  // Create a new scenario
  ({ project, study, scenario } = await setupScenario());
});

test.beforeEach(async ({ page }) => {
  // Navigate to the home page and set up the required settings
  const homePage = new HomePage(page);
  await homePage.goToHomePage();
  selectedLanguage = await homePage.getOSRDLanguage();

  // Navigate to the created scenario page
  await page.goto(
    `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
  );
});

test.describe('Verifying that all elements in the route tab are loaded correctly', () => {
  test('should correctly select a route for operational study', async ({ page, browserName }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const scenarioPage = new ScenarioPage(page);

    // Verify that the infrastructure is correctly loaded
    await scenarioPage.checkInfraLoaded();

    // Click on add train button
    await operationalStudiesPage.clickOnAddTrainBtn();

    // Verify the presence of warnings in Rolling Stock and Route Tab
    await operationalStudiesPage.verifyTabWarningPresence();

    // Select electric rolling stock
    await operationalStudiesPage.selectRollingStock(electricRollingStockName);

    // Perform pathfinding and verify no selected route
    await scenarioPage.openTabByDataId('tab-pathfinding');
    await operationalStudiesPage.verifyNoSelectedRoute(selectedLanguage);
    await operationalStudiesPage.performPathfindingByTrigram('WS', 'NES', 'MES');

    /* Verify map markers in Chromium browser only:  
    This check is not performed in Firefox because the map does not load correctly in Firefox. */
    if (browserName === 'chromium') {
      const expectedMapMarkersValues = ['West_station', 'North_East_station', 'Mid_East_station'];
      await operationalStudiesPage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Verify absence of tab warning
    await operationalStudiesPage.verifyTabWarningAbsence();
  });

  test('should correctly add waypoints in a route for operational study', async ({
    page,
    browserName,
  }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const scenarioPage = new ScenarioPage(page);

    // Click on add train button
    await operationalStudiesPage.clickOnAddTrainBtn();

    // Select electric rolling stock
    await operationalStudiesPage.selectRollingStock(electricRollingStockName);

    // Perform pathfinding
    await scenarioPage.openTabByDataId('tab-pathfinding');
    await operationalStudiesPage.performPathfindingByTrigram('WS', 'NES');

    // Add new waypoints
    const expectedViaValues = [
      { name: 'Mid_West_station', ch: 'BV', uic: '3', km: 'KM 11.850' },
      { name: 'Mid_East_station', ch: 'BV', uic: '4', km: 'KM 26.300' },
    ];
    await operationalStudiesPage.addNewWaypoints(
      2,
      ['Mid_West_station', 'Mid_East_station'],
      expectedViaValues
    );

    /* Verify map markers in Chromium browser:
    This check is not performed in Firefox because the map does not load correctly in Firefox. */
    if (browserName === 'chromium') {
      const expectedMapMarkersValues = [
        'West_station',
        'Mid_West_station',
        'Mid_East_station',
        'North_East_station',
      ];
      await operationalStudiesPage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Verify absence of tab warning
    await operationalStudiesPage.verifyTabWarningAbsence();
  });

  test('should correctly reverse and delete waypoints in a route for operational study', async ({
    browserName,
    page,
  }) => {
    test.slow(browserName === 'webkit', 'This test is slow on safari');
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const scenarioPage = new ScenarioPage(page);

    // Click on add train button
    await operationalStudiesPage.clickOnAddTrainBtn();

    // Select electric rolling stock
    await operationalStudiesPage.selectRollingStock(electricRollingStockName);

    // Perform pathfinding
    await scenarioPage.openTabByDataId('tab-pathfinding');
    await operationalStudiesPage.performPathfindingByTrigram('WS', 'SES', 'MWS');
    const expectedMapMarkersValues = ['West_station', 'South_East_station', 'Mid_West_station'];
    if (browserName === 'chromium') {
      await operationalStudiesPage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Reverse the itinerary and verify the map markers
    await operationalStudiesPage.clickOnReverseItinerary();
    if (browserName === 'chromium') {
      const reversedMapMarkersValues = [...expectedMapMarkersValues].reverse();
      await operationalStudiesPage.verifyMapMarkers(...reversedMapMarkersValues);
    }

    // Delete operational points and verify no selected route
    await operationalStudiesPage.clickOnDeleteOPButtons(selectedLanguage);
    await operationalStudiesPage.verifyNoSelectedRoute(selectedLanguage);

    // Search by trigram and verify map markers
    await operationalStudiesPage.performPathfindingByTrigram('WS', 'SES', 'MWS');
    if (browserName === 'chromium') {
      await operationalStudiesPage.verifyMapMarkers(...expectedMapMarkersValues);
    }

    // Delete itinerary and verify no selected route
    await operationalStudiesPage.clickDeleteItineraryButton();
    await operationalStudiesPage.verifyNoSelectedRoute(selectedLanguage);
  });
});
