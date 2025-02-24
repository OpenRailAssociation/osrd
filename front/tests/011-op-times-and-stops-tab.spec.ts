import { expect } from '@playwright/test';

import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import { dualModeRollingStockName } from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import RouteTab from './pages/operational-studies/route-tab';
import TimeAndStopSimulationOutputs from './pages/operational-studies/time-stop-simulation-outputs';
import TimesAndStopsTab from './pages/operational-studies/times-and-stops-tab';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import { cleanWhitespace, cleanWhitespaceInArray } from './utils/data-normalizer';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import scrollContainer from './utils/scroll-helper';
import { deleteScenario } from './utils/teardown-utils';
import type { FlatTranslations, StationData } from './utils/types';

const enTranslations: FlatTranslations = readJsonFile('public/locales/en/timesStops.json');
const frTranslations: FlatTranslations = readJsonFile('public/locales/fr/timesStops.json');

test.describe('Times and Stops Tab Verification', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  let operationalStudiesPage: OperationalStudiesPage;
  let rollingStockSelector: RollingStockSelector;
  let routeTab: RouteTab;
  let timesAndStopsTab: TimesAndStopsTab;
  let timeAndStopSimulationOutputs: TimeAndStopSimulationOutputs;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;
  let translations: FlatTranslations;

  // Load test data for table inputs and expected results
  const initialInputsData: CellData[] = readJsonFile(
    './tests/assets/operation-studies/times-and-stops/initial-inputs.json'
  );
  const updatedInputsData: CellData[] = readJsonFile(
    './tests/assets/operation-studies/times-and-stops/updated-inputs.json'
  );
  const outputExpectedCellData: StationData[] = readJsonFile(
    './tests/assets/operation-studies/times-and-stops/expected-outputs-cells-data.json'
  );
  const inputExpectedData: JSON = readJsonFile(
    './tests/assets/operation-studies/times-and-stops/expected-inputs-cells-data.json'
  );
  const updatedCellData: JSON = readJsonFile(
    './tests/assets/operation-studies/times-and-stops/updated-inputs-cells-data.json'
  );

  // Waypoints data for route verification
  const expectedViaValues = [
    { name: 'Mid_West_station', ch: 'BV', uic: '3', km: 'KM 12.050' },
    { name: 'Mid_East_station', ch: 'BV', uic: '4', km: 'KM 26.500' },
  ];

  // Define interface for table cell data
  interface CellData {
    stationName: string;
    header: string;
    value: string;
    marginForm?: string;
  }

  test.beforeAll('Fetch infrastructure and get translation', async () => {
    infra = await getInfra();
    translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
  });

  test.beforeEach(
    'Navigate to Times and Stops tab with rolling stock and route set',
    async ({ page }) => {
      [
        operationalStudiesPage,
        routeTab,
        rollingStockSelector,
        timesAndStopsTab,
        timeAndStopSimulationOutputs,
      ] = [
        new OperationalStudiesPage(page),
        new RouteTab(page),
        new RollingStockSelector(page),
        new TimesAndStopsTab(page),
        new TimeAndStopSimulationOutputs(page),
      ];

      // Set up scenario for operational study
      ({ project, study, scenario } = await createScenario());

      // Navigate to the operational study scenario page
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      // Wait for infra to be in 'CACHED' state before proceeding
      await waitForInfraStateToBeCached(infra.id);

      // Setup train configuration and schedule
      await operationalStudiesPage.clickOnAddTrainButton();
      await operationalStudiesPage.setTrainStartTime('11:22:40');
      await rollingStockSelector.selectRollingStock(dualModeRollingStockName);
      await operationalStudiesPage.setTrainScheduleName('Train-name-e2e-test');

      // Perform route pathfinding
      await operationalStudiesPage.clickOnRouteTab();
      await routeTab.performPathfindingByTrigram('WS', 'NES');

      // Navigate to the Times and Stops tab and scroll to the data sheet
      await operationalStudiesPage.clickOnTimesAndStopsTab();
      await scrollContainer(page, '.time-stops-datasheet .dsg-container');
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test('should correctly set and display times and stops tables', async ({ page }) => {
    const expectedColumnNames = cleanWhitespaceInArray([
      translations.name,
      translations.ch,
      translations.trackName,
      translations.arrivalTime,
      translations.stopTime,
      translations.departureTime,
      translations.receptionOnClosedSignal,
      translations.shortSlipDistance,
      translations.theoreticalMargin,
    ]);

    // Verify table headers match the expected headers
    const actualColumnHeaders = cleanWhitespaceInArray(
      await timesAndStopsTab.columnHeaders.allInnerTexts()
    );
    expect(actualColumnHeaders).toEqual(expectedColumnNames);

    // Verify initial row count and fill table with input data
    await timesAndStopsTab.verifyActiveRowsCount(2);
    for (const cell of initialInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        cell.marginForm
      );
    }

    // Verify changes to the input table and additional rows
    await timesAndStopsTab.verifyActiveRowsCount(4);
    await timesAndStopsTab.verifyDeleteButtons(2);
    await timesAndStopsTab.verifyInputTableData(inputExpectedData);

    // Validate waypoints after switching to the Route tab
    await operationalStudiesPage.clickOnRouteTab();
    for (const [viaIndex, expectedValue] of expectedViaValues.entries()) {
      const droppedWaypoint = routeTab.droppedWaypoints.nth(viaIndex);
      await RouteTab.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );
    }

    // Add train schedule, verify results and output table data
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();

    // Scroll and extract output table data for verification
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await timeAndStopSimulationOutputs.getOutputTableData(outputExpectedCellData);
  });

  test('should correctly update and clear input table row', async () => {
    // Fill table cells with initial input data
    for (const cell of initialInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        cell.marginForm
      );
    }

    await timesAndStopsTab.verifyInputTableData(inputExpectedData);

    // Update table inputs with new data
    await timesAndStopsTab.verifyActiveRowsCount(4);
    for (const cell of updatedInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        cell.marginForm
      );
    }

    // Delete a row and verify changes
    await timesAndStopsTab.verifyDeleteButtons(2);
    await timesAndStopsTab.deleteButtons.nth(0).click();
    await timesAndStopsTab.verifyActiveRowsCount(4); // No reduction in rows after deletion
    await timesAndStopsTab.verifyDeleteButtons(1);
    await timesAndStopsTab.verifyInputTableData(updatedCellData);

    // Verify waypoints after switching to the Route tab
    await operationalStudiesPage.clickOnRouteTab();
    for (const [viaIndex, expectedValue] of expectedViaValues.entries()) {
      const droppedWaypoint = routeTab.droppedWaypoints.nth(viaIndex);
      await RouteTab.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );
    }
  });
});
