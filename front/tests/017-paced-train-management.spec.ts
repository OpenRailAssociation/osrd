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
import ScenarioPage from './pages/operational-studies/scenario-page';
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
  let scenarioPage: ScenarioPage;

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

  test.beforeEach('Go to scenario page', async ({ page }) => {
    [
      rollingstockSelector,
      operationalStudiesPage,
      scenarioTimetableSection,
      routeTab,
      pacedTrainSection,
      timesAndStopsTab,
      simulationResultPage,
      timeAndStopSimulationOutputs,
      scenarioPage,
    ] = [
      new RollingStockSelector(page),
      new OperationalStudiesPage(page),
      new ScenarioTimetableSection(page),
      new RouteTab(page),
      new PacedTrainSection(page),
      new TimesAndStopsTab(page),
      new OpSimulationResultPage(page),
      new TimeAndStopSimulationOutputs(page),
      new ScenarioPage(page),
    ];

    // Navigate to the scenario page for the given project and study
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );
    await operationalStudiesPage.removeViteOverlay();

    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify default behaviors with paced train mode', async () => {
    await operationalStudiesPage.openTimetableItemForm();

    // Verify that all configuration buttons and inputs are visible and have their proper default values
    await operationalStudiesPage.checkInputsAndButtons(frTranslations, scenario.creation_date);

    // Verify that all tabs are visible and their default behavior is correct
    await operationalStudiesPage.checkTabs();

    // Check the define paced train checkbox
    await operationalStudiesPage.checkPacedTrainModeAndVerifyInputs(frTranslations);

    // Test the paced train mode behavior
    await operationalStudiesPage.testPacedTrainMode(frTranslations);
  });

  /** *************** Test 2 **************** */
  test('Add a paced train and verify its timetable details', async ({ page, browserName }) => {
    await operationalStudiesPage.openTimetableItemForm();

    // Set the paced train inputs
    await operationalStudiesPage.fillPacedTrainSettings(NEW_PACED_TRAIN_SETTINGS);

    // Select a rolling stock
    await rollingstockSelector.selectRollingStock(dualModeRollingStockName);

    // Select an itinerary
    await operationalStudiesPage.openRouteTab();
    await routeTab.performPathfindingByTrigram({
      originTrigram: 'WS',
      destinationTrigram: 'NES',
    });
    await operationalStudiesPage.checkPathfindingDistance('46.050 km');

    // Verify initial row count and fill table with input data
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

    // Add paced train
    await operationalStudiesPage.createTimetableItem();

    // Verify the paced train has been added and return to the simulation results and timetable
    await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.pacedTrains.added);
    await operationalStudiesPage.returnSimulationResult();

    // Confirm that the number of paced trains added matches the expected number
    await scenarioTimetableSection.verifyTimetableItemsCount(1); // Only one paced train can be added at a time

    await pacedTrainSection.verifyPacedTrainItemDetails(NEW_PACED_TRAIN_SETTINGS, 0, {
      occurrenceData: ADD_PACED_TRAIN_OCCURRENCES_DETAILS[0],
    });

    // Click on occurrence to check its simulation results
    await pacedTrainSection.selectOccurrence({ pacedTrainIndex: 0, occurrenceIndex: 0 });
    await scenarioPage.toggleTrainList();
    if (browserName === 'chromium') {
      await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
        'SpeedSpaceChart-InitialInputs.png'
      );
    }
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await timeAndStopSimulationOutputs.getOutputTableData(expectedOutputData);
  });

  /** *************** Test 3 **************** */
  test('Duplicate and delete a paced train', async ({ page }) => {
    await sendPacedTrains(scenario.timetable_id, pacedTrainsJson);

    // to trigger list of paced train initialization for this e2e test, which isn't needed locally
    await page.reload();

    await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS,
      totalTrainScheduleCount: 0,
    });

    // Duplicate the first paced train
    await pacedTrainSection.duplicatePacedTrain();

    // Verify that a toast is displayed
    await operationalStudiesPage.checkToastHasBeenLaunched(
      frTranslations.timetable.pacedTrainAdded
    );

    // Verify that there is one more paced train in the list
    await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS + 1,
      totalTrainScheduleCount: 0,
    });

    // Verify that the duplicated paced train has the proper details
    await pacedTrainSection.verifyPacedTrainItemDetails(DUPLICATED_PACED_TRAIN_DETAILS, 1, {
      occurrenceData: DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
      copyTranslation: frTranslations.timetable.copy,
    });

    // Verify global item counter has one more paced train
    await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS_WITH_DUPLICATE,
      totalTrainScheduleCount: 0,
    });

    // Delete the duplicated paced train
    await pacedTrainSection.deletePacedTrain(
      DUPLICATED_PACED_TRAIN_INDEX,
      frTranslations,
      DUPLICATED_PACED_TRAIN_DETAILS
    );

    // Verify global item counter has one less paced train
    await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS,
      totalTrainScheduleCount: 0,
    });
  });
});
