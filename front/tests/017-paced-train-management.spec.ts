import { expect } from '@playwright/test';

import type { Infra, PacedTrain, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import {
  ADD_PACED_TRAIN_OCCURRENCES_DETAILS,
  DUPLICATED_PACED_TRAIN_DETAILS,
  DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
  NEW_PACED_TRAIN_SETTINGS,
} from './assets/constants/operational-studies-const';
import { dualModeRollingStockName } from './assets/constants/project-const';
import {
  DUPLICATED_PACED_TRAIN_INDEX,
  TOTAL_PACED_TRAINS,
  TOTAL_PACED_TRAINS_WITH_DUPLICATE,
} from './assets/constants/timetable-items-count';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import RouteTab from './pages/operational-studies/route-tab';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import OpSimulationResultPage from './pages/operational-studies/simulation-results-page';
import TimeAndStopSimulationOutputs from './pages/operational-studies/time-stop-simulation-outputs';
import TimesAndStopsTab from './pages/operational-studies/times-and-stops-tab';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import { cleanWhitespace } from './utils/data-normalizer';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import scrollContainer from './utils/scroll-helper';
import { deleteScenario } from './utils/teardown-utils';
import type {
  CellData,
  CommonTranslations,
  FlatTranslations,
  ManageTimetableItemTranslations,
  StationData,
  TimetableFilterTranslations,
} from './utils/types';

const frManageTimetableItemTranslations: ManageTimetableItemTranslations = readJsonFile<{
  manageTimetableItem: ManageTimetableItemTranslations;
}>('public/locales/fr/operational-studies.json').manageTimetableItem;

const frTimeStopsTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const frTranslations = {
  ...frManageTimetableItemTranslations,
  ...frTimeStopsTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const initialInputsData: CellData[] = readJsonFile(
  './tests/assets/operation-studies/times-and-stops/initial-inputs.json'
);

const expectedOutputData: StationData[] = readJsonFile(
  './tests/assets/paced-train/output-table-data.json'
);

const pacedTrainsJson = readJsonFile<[PacedTrain]>('./tests/assets/paced-train/paced_trains.json');

test.describe('Verify simulation configuration in operational studies for train schedules and paced trains', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let rollingstockSelector: RollingStockSelector;
  let operationalStudiesPage: OperationalStudiesPage;
  let scenarioTimetableSection: ScenarioTimetableSection;
  let routeTab: RouteTab;
  let pacedTrainSection: PacedTrainSection;
  let timesAndStopsTab: TimesAndStopsTab;
  let simulationResultPage: OpSimulationResultPage;
  let timeAndStopSimulationOutputs: TimeAndStopSimulationOutputs;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch infrastructure and set up the scenario', async () => {
    infra = await getInfra();
    ({ project, study, scenario } = await createScenario());
  });

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page }) => {
      [
        rollingstockSelector,
        operationalStudiesPage,
        scenarioTimetableSection,
        routeTab,
        pacedTrainSection,
        timesAndStopsTab,
        simulationResultPage,
        timeAndStopSimulationOutputs,
      ] = [
        new RollingStockSelector(page),
        new OperationalStudiesPage(page),
        new ScenarioTimetableSection(page),
        new RouteTab(page),
        new PacedTrainSection(page),
        new TimesAndStopsTab(page),
        new OpSimulationResultPage(page),
        new TimeAndStopSimulationOutputs(page),
      ];

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await operationalStudiesPage.removeViteOverlay();
      await waitForInfraStateToBeCached(infra.id);
    }
  );

  /** *************** Test 1 **************** */
  test('Verify default behaviors with paced train mode', async () => {
    await test.step('Open timetable item form', async () => {
      await operationalStudiesPage.openTimetableItemForm();
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
  test('Add a paced train and verify its timetable details', async ({ page, browserName }) => {
    await test.step('Open timetable item form', async () => {
      await operationalStudiesPage.openTimetableItemForm();
    });

    await test.step('Fill paced train inputs', async () => {
      await operationalStudiesPage.fillPacedTrainSettings(NEW_PACED_TRAIN_SETTINGS);
    });

    await test.step('Select rolling stock', async () => {
      await rollingstockSelector.selectRollingStock(dualModeRollingStockName);
    });

    await test.step('Select itinerary and verify distance', async () => {
      await operationalStudiesPage.openRouteTab();
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'NES',
      });
      await operationalStudiesPage.checkPathfindingDistance('46.050 km');
    });

    await test.step('Fill Times & Stops table with initial inputs', async () => {
      await operationalStudiesPage.openTimesAndStopsTab();
      await scrollContainer(page, '.time-stops-datasheet .dsg-container');
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
      await operationalStudiesPage.createTimetableItem();
      await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.pacedTrains.added);
      await operationalStudiesPage.returnSimulationResult();
    });

    await test.step('Verify list contains exactly one paced train', async () => {
      await scenarioTimetableSection.verifyTimetableItemsCount(1);
    });

    await test.step('Verify paced train card and first occurrence details', async () => {
      await pacedTrainSection.verifyPacedTrainItemDetails(NEW_PACED_TRAIN_SETTINGS, 0, {
        occurrenceData: ADD_PACED_TRAIN_OCCURRENCES_DETAILS[0],
      });
    });

    await test.step('Open first occurrence and verify its simulation results (screenshot comparison for the GEV)', async () => {
      await pacedTrainSection.selectOccurrence({ pacedTrainIndex: 0, occurrenceIndex: 0 });
      await simulationResultPage.setTrainListVisible();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-InitialInputs.png'
        );
      }
      await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
      await timeAndStopSimulationOutputs.getOutputTableData(expectedOutputData);
    });
  });

  /** *************** Test 3 **************** */
  test('Duplicate and delete a paced train', async ({ page }) => {
    await test.step('Set paced trains via API and reload to initialize list', async () => {
      await sendPacedTrains(scenario.timetable_id, pacedTrainsJson);
      await page.reload();
    });

    await test.step('Verify initial counters', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalTrainScheduleCount: 0,
      });
    });

    await test.step('Duplicate first paced train and verify toast notification', async () => {
      await pacedTrainSection.duplicatePacedTrain();
      await operationalStudiesPage.checkToastHasBeenLaunched(
        frTranslations.timetable.pacedTrainAdded
      );
    });

    await test.step('Verify counters increased by one', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS + 1,
        totalTrainScheduleCount: 0,
      });
    });

    await test.step('Verify duplicated paced train details', async () => {
      await pacedTrainSection.verifyPacedTrainItemDetails(DUPLICATED_PACED_TRAIN_DETAILS, 1, {
        occurrenceData: DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
        copyTranslation: frTranslations.timetable.copy,
      });
    });

    await test.step('Verify global counter with duplicate', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS_WITH_DUPLICATE,
        totalTrainScheduleCount: 0,
      });
    });

    await test.step('Delete duplicated paced train and verify counters', async () => {
      await pacedTrainSection.deletePacedTrain(
        DUPLICATED_PACED_TRAIN_INDEX,
        frTranslations,
        DUPLICATED_PACED_TRAIN_DETAILS
      );
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalTrainScheduleCount: 0,
      });
    });
  });
});
