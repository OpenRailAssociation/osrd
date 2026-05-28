import { expect } from '@playwright/test';

import type {
  Infra,
  TrainSchedule,
  Project,
  Scenario,
  Study,
  TrainScheduleSet,
} from 'common/api/osrdEditoastApi';

import {
  ADD_PACED_TRAIN_OCCURRENCES_DETAILS,
  DUPLICATED_PACED_TRAIN_DETAILS,
  DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
  NEW_PACED_TRAIN_SETTINGS,
} from '../../assets/constants/operational-studies-const';
import { dualModeRollingStockName } from '../../assets/constants/project-const';
import {
  DUPLICATED_PACED_TRAIN_INDEX,
  TOTAL_PACED_TRAINS,
  TOTAL_PACED_TRAINS_WITH_DUPLICATE,
} from '../../assets/constants/train-schedules-count';
import { FREIGHT_TRAIN, HIGH_SPEED_TRAIN_COLOR } from '../../assets/operation-studies/train-const';
import { pacedTrainOutputData } from '../../assets/paced-train/output-table-data';
import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra } from '../../utils/api-utils';
import { cleanWhitespace } from '../../utils/data-normalizer';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type {
  CellData,
  CommonTranslations,
  FlatTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';

const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const frTimeStopsTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const frTranslations = {
  ...frManageTrainScheduleTranslations,
  ...frTimeStopsTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const initialInputsData: CellData[] = readJsonFile(
  './tests/assets/operation-studies/times-and-stops/initial-inputs.json'
);

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe('Paced train management', { tag: ['@op', '@paced-trains'] }, () => {
  test.slow(); // TODO remove this once this PR is merged: #16969
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let trainScheduleSet: TrainScheduleSet;
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page }) => {
      ({ project, study, scenario, trainScheduleSet } = await createScenario());
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  /** *************** Test 1 **************** */
  test('Verify default behaviors with paced train mode', async ({ operationalStudiesPage }) => {
    await test.step('Open train schedule form', async () => {
      await operationalStudiesPage.openTrainScheduleForm();
    });

    await test.step('Verify default inputs/buttons', async () => {
      await operationalStudiesPage.checkInputsAndButtons(frTranslations, scenario.creation_date);
    });

    await test.step('Verify tabs default behavior', async () => {
      await operationalStudiesPage.checkTabs();
    });

    await test.step('Enable paced train mode and verify inputs', async () => {
      await operationalStudiesPage.checkPacedTrainModeAndVerifyInputs(frTranslations);
    });

    await test.step('Test paced train mode behavior', async () => {
      await operationalStudiesPage.testPacedTrainMode(frTranslations);
    });
  });

  /** *************** Test 2 **************** */
  test(
    'Add a paced train and verify its timetable details',
    { tag: '@smoke' },
    async ({
      browserName,
      operationalStudiesPage,
      rollingStockSelector,
      routeTab,
      timesAndStopsTab,
      scenarioTimetableSection,
      pacedTrainSection,
      opSimulationResultPage,
      timesStopsTablePage,
    }) => {
      await test.step('Open train schedule form', async () => {
        await operationalStudiesPage.openTrainScheduleForm();
      });

      await test.step('Fill paced train inputs', async () => {
        await operationalStudiesPage.fillPacedTrainSettings(NEW_PACED_TRAIN_SETTINGS);
      });

      await test.step('Select rolling stock', async () => {
        await rollingStockSelector.selectRollingStock(dualModeRollingStockName);
      });

      await test.step('Select itinerary and verify distance', async () => {
        await operationalStudiesPage.openRouteTab();
        await routeTab.performPathfindingByMainCode({
          originMainCode: 'WS',
          destinationMainCode: 'NES',
        });
        await operationalStudiesPage.checkPathfindingDistance('46.050 km');
      });

      await test.step('Fill Times & Stops table with initial inputs', async () => {
        await operationalStudiesPage.openTimesAndStopsTab();
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

      await test.step('Create paced train and return to results', async () => {
        await operationalStudiesPage.createTrainSchedule();
        await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.pacedTrains.added);
        await operationalStudiesPage.returnSimulationResult();
      });

      await test.step('Verify list contains exactly one paced train', async () => {
        await scenarioTimetableSection.verifyTrainSchedulesCount(1);
      });

      await test.step('Verify paced train is selected when clicked', async () => {
        await pacedTrainSection.verifyPacedTrainSelected(0);
      });

      await test.step('Verify result in output table is paced train result', async () => {
        await opSimulationResultPage.setTrainListVisible();
        await timesStopsTablePage.verifyTimesStopsTableContent(pacedTrainOutputData.pacedTrain);
      });

      await test.step('Verify paced train card and first occurrence details', async () => {
        await scenarioTimetableSection.setTrainListVisible(false);
        await pacedTrainSection.verifyPacedTrainItemDetails(NEW_PACED_TRAIN_SETTINGS, 0, {
          occurrenceData: ADD_PACED_TRAIN_OCCURRENCES_DETAILS[0],
          occurrenceColor: FREIGHT_TRAIN.color,
        });
      });

      await test.step('Open first occurrence and verify its simulation results (screenshot comparison for the GEV)', async () => {
        await pacedTrainSection.selectOccurrence({ pacedTrainIndex: 0, occurrenceIndex: 1 });
        await opSimulationResultPage.setTrainListVisible();
        if (browserName === 'chromium') {
          await expect(opSimulationResultPage.speedSpaceChart).toHaveScreenshot(
            'SpeedSpaceChart-InitialInputs.png'
          );
        }
        await timesStopsTablePage.verifyTimesStopsTableContent(
          pacedTrainOutputData.secondOccurrence
        );
      });
    }
  );

  /** *************** Test 3 **************** */
  test('Duplicate and delete a paced train', async ({
    page,
    scenarioTimetableSection,
    pacedTrainSection,
    operationalStudiesPage,
  }) => {
    await test.step('Set paced trains via API and reload to initialize list', async () => {
      await sendTrains(trainScheduleSet.id, trains.slice(0, 7));
      await page.reload();
    });

    await test.step('Verify initial counters', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: 0,
      });
    });

    await test.step('Duplicate first paced train and verify toast notification', async () => {
      await pacedTrainSection.duplicatePacedTrain();
      await operationalStudiesPage.checkToastHasBeenLaunched(
        frTranslations.timetable.pacedTrainAdded
      );
    });

    await test.step('Verify counters increased by one', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS + 1,
        totalUniqueTrainCount: 0,
      });
    });

    await test.step('Verify duplicated paced train details', async () => {
      await pacedTrainSection.verifyPacedTrainItemDetails(DUPLICATED_PACED_TRAIN_DETAILS, 1, {
        occurrenceData: DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
        copyTranslation: frTranslations.timetable.copy,
        occurrenceColor: HIGH_SPEED_TRAIN_COLOR,
      });
    });

    await test.step('Verify global counter with duplicate', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS_WITH_DUPLICATE,
        totalUniqueTrainCount: 0,
      });
    });

    await test.step('Delete duplicated paced train and verify counters', async () => {
      await pacedTrainSection.deletePacedTrain(
        DUPLICATED_PACED_TRAIN_INDEX,
        frTranslations,
        DUPLICATED_PACED_TRAIN_DETAILS
      );
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: 0,
      });
    });
  });
});
