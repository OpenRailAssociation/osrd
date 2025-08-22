import { expect } from '@playwright/test';

import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import { dualModeRollingStockName } from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import RouteTab from './pages/operational-studies/route-tab';
import TimeAndStopSimulationOutputs from './pages/operational-studies/time-stop-simulation-outputs';
import TimesAndStopsTab from './pages/operational-studies/times-and-stops-tab';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import { cleanWhitespace, cleanWhitespaceInArray } from './utils/data-normalizer';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import scrollContainer from './utils/scroll-helper';
import { deleteScenario } from './utils/teardown-utils';
import type { CellData, FlatTranslations, StationData } from './utils/types';

const frTranslations: FlatTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

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
  { name: 'Mid_West_station', ch: 'BV', uic: '33', km: 'KM 12.050' },
  { name: 'Mid_East_station', ch: 'BV', uic: '44', km: 'KM 26.500' },
];

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

  test.beforeAll('Fetch infrastructure and get translation', async () => {
    infra = await getInfra();
  });

  test.beforeEach(async ({ page }) => {
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

    await test.step('Create then navigate to scenario page', async () => {
      // Set up scenario for operational study
      ({ project, study, scenario } = await createScenario());

      // Navigate to the operational study scenario page
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      // Wait for infra to be in 'CACHED' state before proceeding
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Add a new train schedule, set its properties and perform pathfinding', async () => {
      // Setup train schedule configuration and schedule
      await operationalStudiesPage.openTimetableItemForm();
      await operationalStudiesPage.setTimetableItemStartTime('11:22:40');
      await rollingStockSelector.selectRollingStock(dualModeRollingStockName);
      await operationalStudiesPage.setTimetableItemName('Train-name-e2e-test');

      // Perform route pathfinding
      await operationalStudiesPage.openRouteTab();
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'NES',
      });

      // Navigate to the Times and Stops tab and scroll to the data sheet
      await operationalStudiesPage.openTimesAndStopsTab();
      await scrollContainer(page, '.time-stops-datasheet .dsg-container');
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test('should correctly set and display times and stops tables', async ({ page }) => {
    await test.step('Verify table headers', async () => {
      const expectedColumnNames = cleanWhitespaceInArray([
        frTranslations.name,
        frTranslations.ch,
        frTranslations.trackName,
        frTranslations.arrivalTime,
        frTranslations.stopTime,
        frTranslations.departureTime,
        frTranslations.receptionOnClosedSignal,
        frTranslations.shortSlipDistance,
        frTranslations.theoreticalMargin,
      ]);
      const actualColumnHeaders = cleanWhitespaceInArray(
        await timesAndStopsTab.columnHeaders.allInnerTexts()
      );
      expect(actualColumnHeaders).toEqual(expectedColumnNames);
    });

    await test.step('Fill initial inputs (2 active rows → 4 active rows)', async () => {
      await timesAndStopsTab.verifyActiveRowsCount(2);
      for (const cell of initialInputsData) {
        const translatedHeader = cleanWhitespace(frTranslations[cell.header]);
        await timesAndStopsTab.fillTableCellByStationAndHeader(
          cell.stationName,
          translatedHeader,
          cell.value,
          cell.marginForm
        );
      }
    });

    await test.step('Verify input table state after fill', async () => {
      await timesAndStopsTab.verifyActiveRowsCount(4);
      await timesAndStopsTab.verifyClearButtons(2);
      await timesAndStopsTab.verifyInputTableData(inputExpectedData);
    });

    await test.step('Validate waypoints in Route tab', async () => {
      await operationalStudiesPage.openRouteTab();
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

    await test.step('Create timetable item, open results and verify outputs', async () => {
      await operationalStudiesPage.createTimetableItem();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();

      await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
      await timeAndStopSimulationOutputs.getOutputTableData(outputExpectedCellData);
    });
  });

  test('should correctly update and clear input table row', async () => {
    await test.step('Fill initial inputs and verify table', async () => {
      for (const cell of initialInputsData) {
        const translatedHeader = cleanWhitespace(frTranslations[cell.header]);
        await timesAndStopsTab.fillTableCellByStationAndHeader(
          cell.stationName,
          translatedHeader,
          cell.value,
          cell.marginForm
        );
      }
      await timesAndStopsTab.verifyInputTableData(inputExpectedData);
    });

    await test.step('Update inputs (keep 4 active rows)', async () => {
      await timesAndStopsTab.verifyActiveRowsCount(4);
      for (const cell of updatedInputsData) {
        const translatedHeader = cleanWhitespace(frTranslations[cell.header]);
        await timesAndStopsTab.fillTableCellByStationAndHeader(
          cell.stationName,
          translatedHeader,
          cell.value,
          cell.marginForm
        );
      }
    });

    await test.step('Clear a row and verify new state (row count remains unchanged)', async () => {
      await timesAndStopsTab.verifyClearButtons(2);
      await timesAndStopsTab.clearRow(0);
      await timesAndStopsTab.verifyActiveRowsCount(4);
      await timesAndStopsTab.verifyClearButtons(1);
      await timesAndStopsTab.verifyInputTableData(updatedCellData);
    });

    await test.step('Validate waypoints after updates (Route tab)', async () => {
      await operationalStudiesPage.openRouteTab();
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
});
