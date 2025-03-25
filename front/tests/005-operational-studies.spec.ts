import { expect } from '@playwright/test';

import type {
  Infra,
  LightRollingStock,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import {
  ADD_PACED_TRAIN_OCCURRENCES_DETAILS,
  DUPLICATED_PACED_TRAIN_DETAILS,
  DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
  NEW_PACED_TRAIN_SETTINGS,
} from './assets/constants/operational-studies-const';
import {
  dualModeRollingStockName,
  electricRollingStockName,
} from './assets/constants/project-const';
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
import { getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra, getRollingStock } from './utils/api-utils';
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
  ManageTrainScheduleTranslations,
  StationData,
  TimetableFilterTranslations,
} from './utils/types';

const enManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile(
  'public/locales/en/operationalStudies/manageTrainSchedule.json'
);
const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/manageTrainSchedule.json'
);

const enTimeStopsTranslations: FlatTranslations = readJsonFile('public/locales/en/timesStops.json');
const frTimeStopsTranslations: FlatTranslations = readJsonFile('public/locales/fr/timesStops.json');

const enScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/en/operationalStudies/scenario.json'
);
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/scenario.json'
);

const enCommonTranslations: CommonTranslations = readJsonFile('public/locales/en/translation.json');
const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const initialInputsData: CellData[] = readJsonFile(
  './tests/assets/operation-studies/times-and-stops/initial-inputs.json'
);

const expectedOutputData: StationData[] = readJsonFile(
  './tests/assets/paced-train/output-table-data.json'
);

const pacedTrainsJson: JSON = readJsonFile('./tests/assets/paced-train/paced_trains.json');

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
  let rollingStock: LightRollingStock;
  let translations: ManageTrainScheduleTranslations &
    TimetableFilterTranslations &
    CommonTranslations;

  test.beforeAll('Fetch infrastructure and get translations', async () => {
    rollingStock = await getRollingStock(electricRollingStockName);
    infra = await getInfra();
    translations = getTranslations({
      en: {
        ...enManageTrainScheduleTranslations,
        ...enTimeStopsTranslations,
        ...enScenarioTranslations,
        ...enCommonTranslations,
      },
      fr: {
        ...frManageTrainScheduleTranslations,
        ...frTimeStopsTranslations,
        ...frScenarioTranslations,
        ...frCommonTranslations,
      },
    });
  });

  test.beforeEach('Set up the project, study, and scenario', async ({ page }) => {
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

    ({ project, study, scenario } = await createScenario());

    // Navigate to the scenario page for the given project and study
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);

    await page.waitForLoadState('networkidle');
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  /** *************** Test 1 **************** */
  test('Verify default behaviors with paced train mode', async () => {
    await operationalStudiesPage.clickOnAddTrainButton();

    await operationalStudiesPage.checkPacedTrainSwitch();

    // Verify that all configuration buttons and inputs are visible and have their proper default values
    await operationalStudiesPage.checkInputsAndButtons(translations, scenario.creation_date);

    // Verify that all tabs are visible and their default behavior is correct
    await operationalStudiesPage.checkTabs();

    // Check the define paced train checkbox
    await operationalStudiesPage.checkPacedTrainModeAndVerifyInputs(translations);

    // Test the paced train mode behavior
    await operationalStudiesPage.testPacedTrainMode(translations);
  });

  /** *************** Test 2 **************** */
  test('Add a paced train and verify its timetable details', async ({ page }) => {
    await operationalStudiesPage.clickOnAddTrainButton();

    await operationalStudiesPage.checkPacedTrainSwitch();

    // Set the paced train inputs
    await operationalStudiesPage.fillPacedTrainSettings(NEW_PACED_TRAIN_SETTINGS);

    // Select a rolling stock
    await rollingstockSelector.selectRollingStock(dualModeRollingStockName);

    // Select an itinerary
    await operationalStudiesPage.clickOnRouteTab();
    await routeTab.performPathfindingByTrigram('WS', 'NES');
    await operationalStudiesPage.checkPathfindingDistance('46.000 km');

    // Verify initial row count and fill table with input data
    await operationalStudiesPage.clickOnTimesAndStopsTab();
    await scrollContainer(page, '.time-stops-datasheet .dsg-container');

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

    // Add paced train
    await operationalStudiesPage.addTimetableItem();

    // Verify the paced train has been added and return to the simulation results and timetable
    await operationalStudiesPage.checkToastHasBeenLaunched(translations.pacedTrains.added);
    await operationalStudiesPage.returnSimulationResult();
    await operationalStudiesPage.closeToastNotification();

    // Confirm that the number of paced trains added matches the expected number
    await operationalStudiesPage.checkNumberOfTrains(1); // Only one paced train can be added at a time

    await pacedTrainSection.verifyPacedTrainItemDetails(NEW_PACED_TRAIN_SETTINGS, 0, {
      occurrenceData: ADD_PACED_TRAIN_OCCURRENCES_DETAILS[0],
    });

    // Click on occurrence to check its simulation results
    await pacedTrainSection.clickOnOccurrence({ pacedTrainIndex: 0, occurrenceIndex: 0 });

    await scenarioTimetableSection.clickOnScenarioCollapseButton();

    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-InitialInputs.png'
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await timeAndStopSimulationOutputs.getOutputTableData(expectedOutputData);
  });

  /** *************** Test 3 **************** */
  test('Duplicate and delete a paced train', async () => {
    await sendPacedTrains(scenario.timetable_id, pacedTrainsJson);

    await operationalStudiesPage.checkPacedTrainSwitch();

    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS,
      totalTrainScheduleCount: 0,
    });

    // Duplicate the first paced train
    await pacedTrainSection.duplicatePacedTrain();

    // Verify that a toast is displayed
    await operationalStudiesPage.checkToastHasBeenLaunched(translations.timetable.pacedTrainAdded);

    // Verify that there is one more paced train in the list
    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS + 1,
      totalTrainScheduleCount: 0,
    });

    // Verify that the duplicated paced train has the proper details
    await pacedTrainSection.verifyPacedTrainItemDetails(DUPLICATED_PACED_TRAIN_DETAILS, 1, {
      occurrenceData: DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
      copyTranslation: translations.timetable.copy,
    });

    // Verify global item counter has one more paced train
    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS_WITH_DUPLICATE,
      totalTrainScheduleCount: 0,
    });

    // Delete the duplicated paced train
    await pacedTrainSection.deletePacedTrain(
      DUPLICATED_PACED_TRAIN_DETAILS,
      DUPLICATED_PACED_TRAIN_INDEX,
      translations
    );

    // Verify global item counter has one less paced train
    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS,
      totalTrainScheduleCount: 0,
    });
  });

  // TODO Paced train : Remove this test in https://github.com/OpenRailAssociation/osrd/issues/10791
  /** *************** Test 4 **************** */
  test('Pathfinding with rolling stock and composition code', async () => {
    // Click the button to add a train schedule
    await operationalStudiesPage.clickOnAddTrainButton();

    // Set the train schedule name and number of trains
    await operationalStudiesPage.setTrainScheduleName('TrainSchedule');
    await operationalStudiesPage.setNumberOfTrains('7');

    // Open the rolling stock modal

    await rollingstockSelector.openRollingstockModal();
    await expect(rollingstockSelector.rollingStockSelectorModal).toBeVisible();

    // Test rolling stock search with normalization (spaces and capital letters)
    await rollingstockSelector.searchRollingstock(' electric_Rs_E2e ');

    // Select the rolling stock card based on the test ID
    const rollingstockCard = rollingstockSelector.getRollingstockCardByTestID(
      `rollingstock-${rollingStock.name}`
    );

    // Verify the rolling stock card is inactive initially
    await expect(rollingstockCard).toHaveClass(/inactive/);

    // Select the rolling stock and ensure it becomes active
    await rollingstockCard.click();
    await expect(rollingstockCard).not.toHaveClass(/inactive/);

    // Confirm rolling stock selection by clicking the button on the card
    await rollingstockCard.locator('button').click();

    // Validate that the rolling stock's name and comfort class are displayed correctly
    expect(await rollingstockSelector.getRollingStockMiniCardInfo().first().textContent()).toMatch(
      rollingStock.name
    );
    expect(await rollingstockSelector.getRollingStockInfoComfort().textContent()).toMatch(
      /ConfortSStandard/i
    );

    // Perform Pathfinding and verify the distance
    await operationalStudiesPage.clickOnRouteTab();
    await routeTab.performPathfindingByTrigram('MWS', 'NES');
    await operationalStudiesPage.checkPathfindingDistance('33.950 km');

    // Adding Train Schedule
    await operationalStudiesPage.addTimetableItem();

    // Verify the train has been added and the simulation results
    await operationalStudiesPage.checkToastHasBeenLaunched(translations.trainAdded);
    await operationalStudiesPage.returnSimulationResult();

    // Confirm the number of trains added matches the expected number
    await operationalStudiesPage.checkNumberOfTrains(7);
  });
});
