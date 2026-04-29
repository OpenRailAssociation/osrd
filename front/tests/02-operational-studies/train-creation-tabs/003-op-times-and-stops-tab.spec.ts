import { expect } from '@playwright/test';

import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import { dualModeRollingStockName } from '../../assets/constants/project-const';
import { TRAIN_NAME, TRAIN_START_TIME } from '../../assets/operation-studies/train-const';
import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra } from '../../utils/api-utils';
import { cleanWhitespace, cleanWhitespaceInArray } from '../../utils/data-normalizer';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import type { CellData, FlatTranslations, StationData } from '../../utils/types';

const frTranslations: FlatTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

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

const expectedViaValues = [
  { name: 'Mid_West_station', ch: 'BV', uic: '33', km: 'KM 12.050' },
  { name: 'Mid_East_station', ch: 'BV', uic: '44', km: 'KM 26.500' },
];

test.describe('Times and Stops tab', { tag: ['@op', '@times-stops-tab'] }, () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch infrastructure and get translation', async () => {
    infra = await getInfra();
  });

  test.beforeEach(async ({ page, operationalStudiesPage, rollingStockSelector, routeTab }) => {
    await test.step('Create then navigate to scenario page', async () => {
      ({ project, study, scenario } = await createScenario());

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Add a new unique train and set its properties', async () => {
      await operationalStudiesPage.openTrainScheduleForm();
      await operationalStudiesPage.setTrainScheduleStartTime(TRAIN_START_TIME);
      await rollingStockSelector.selectRollingStock(dualModeRollingStockName);
      await operationalStudiesPage.setTrainScheduleName(TRAIN_NAME);
    });
    await test.step('Perform pathfinding then navigate to Times and Stops tab', async () => {
      await operationalStudiesPage.openRouteTab();
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'NES',
      });
      await operationalStudiesPage.openTimesAndStopsTab();
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  /** *************** Test 1 **************** */
  test(
    'Set and display times and stops tables',
    { tag: '@smoke' },
    async ({
      timesAndStopsTab,
      operationalStudiesPage,
      routeTab,
      timeAndStopSimulationOutputs,
    }) => {
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
          await routeTab.validateAddedWaypoint(
            droppedWaypoint,
            expectedValue.name,
            expectedValue.ch,
            expectedValue.uic
          );
        }
      });

      await test.step('Create train schedule, open results and verify outputs', async () => {
        await operationalStudiesPage.createTrainSchedule();
        await operationalStudiesPage.closeToastNotification();
        await operationalStudiesPage.returnSimulationResult();
        await operationalStudiesPage.verifyTimesStopsDataSheetVisibility();
        await timeAndStopSimulationOutputs.getOutputTableData(outputExpectedCellData);
      });
    }
  );

  /** *************** Test 2 **************** */
  test(
    'Update and clear input table row',
    { tag: '@smoke' },
    async ({ timesAndStopsTab, operationalStudiesPage, routeTab }) => {
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
          await routeTab.validateAddedWaypoint(
            droppedWaypoint,
            expectedValue.name,
            expectedValue.ch,
            expectedValue.uic
          );
        }
      });
    }
  );
});
