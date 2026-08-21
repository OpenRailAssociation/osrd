import { expect } from '@playwright/test';

import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  ADD_PACED_TRAIN_OCCURRENCES_DETAILS,
  DEFAULT_PACED_TRAIN_SERVICE_INTERVAL,
  DUPLICATED_PACED_TRAIN_DETAILS,
  DUPLICATED_PACED_TRAIN_OCCURRENCES_DETAILS,
  NEW_PACED_TRAIN_SETTINGS,
} from '../../assets/constants/operational-studies-const';
import {
  dualModeRollingStockName,
  globalProjectName,
  globalStudyName,
} from '../../assets/constants/project-const';
import { NO_COMPOSITION_CODE_VALUE } from '../../assets/constants/train-header-const';
import {
  DUPLICATED_PACED_TRAIN_INDEX,
  TOTAL_PACED_TRAINS,
  TOTAL_PACED_TRAINS_WITH_DUPLICATE,
} from '../../assets/constants/train-schedules-count';
import { FREIGHT_TRAIN, HIGH_SPEED_TRAIN_COLOR } from '../../assets/operation-studies/train-const';
import {
  DEFAULT_MIDNIGHT_HOUR,
  DEFAULT_PACED_TRAIN_NAME,
  DEFAULT_PACED_TRAIN_ROW_COUNT,
  DEFAULT_PACED_TRAIN_SERVICE_WINDOW_HOURS,
  DEFAULT_PACED_TRAIN_SERVICE_WINDOW_MINUTES,
  MID_EAST_STATION_REQUESTED_ARRIVAL,
  MID_EAST_STATION_STOP_DURATION_DIGITS,
  MID_WEST_STATION_MARGIN_UNIT,
  MID_WEST_STATION_MARGIN_VALUE,
  MID_WEST_STATION_REQUESTED_ARRIVAL,
  MID_WEST_STATION_STOP_DURATION_DIGITS,
  NEW_PACED_TRAIN_DEPARTURE_DATE,
  NEW_PACED_TRAIN_ROUTE_SEARCH,
  NEW_PACED_TRAIN_SERVICE_WINDOW_HOURS,
  NEW_PACED_TRAIN_SERVICE_WINDOW_MINUTES,
  WEST_STATION_MARGIN_UNIT,
  WEST_STATION_MARGIN_VALUE,
  WEST_STATION_REQUESTED_ARRIVAL,
} from '../../assets/paced-train/const';
import { pacedTrainOutputData } from '../../assets/paced-train/output-table-data';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { getTodayShortDate } from '../../utils/date-utils';
import { readJsonFile } from '../../utils/file-utils';
import sendTrains from '../../utils/send-trains';
import type {
  CommonTranslations,
  FlatTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';
import {
  ROCKET_SEARCH_INPUT,
  ROLLING_STOCK_DEFAULT_CATEGORY,
  ROLLING_STOCK_NAME,
  ROLLING_STOCK_NAME_QUERY,
} from '../itineraryModal/itinerary-modal.consts';

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

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe('Paced train management', { tag: ['@op', '@paced-trains'] }, () => {
  const scenarioContext = setupScenarioFixture({
    scenarioNamePrefix: 'paced-train-management-scenario',
    trains: [],
    scope: 'test',
    projectName: globalProjectName,
    studyName: globalStudyName,
  });

  /** *************** Test 1 **************** */
  test('Verify default behaviors with paced train', async ({
    scenarioTimetableSection,
    itineraryModalPage,
    headerPage,
    timesStopsTablePage,
    pacedTrainSection,
  }) => {
    await test.step('Open the itinerary modal and fill in a new train', async () => {
      await scenarioTimetableSection.openItineraryModal();
      await itineraryModalPage.fillRollingStock(ROLLING_STOCK_NAME_QUERY);
      await itineraryModalPage.checkRollingStock(ROLLING_STOCK_NAME);
      await itineraryModalPage.checkCategory(ROLLING_STOCK_DEFAULT_CATEGORY);
      await itineraryModalPage.fillTrainName(DEFAULT_PACED_TRAIN_NAME);
      await itineraryModalPage.launchRocketSearch(ROCKET_SEARCH_INPUT);
    });

    await test.step('Create a service (paced) train', async () => {
      await itineraryModalPage.createServiceTrain();
      await itineraryModalPage.checkTrainPresenceInTimetable(DEFAULT_PACED_TRAIN_NAME);
    });

    await test.step('Verify default cadence and window in the header', async () => {
      await pacedTrainSection.selectPacedTrainModel(0);
      await headerPage.expandHeader();
      await headerPage.verifyServiceCadenceAndWindow(
        DEFAULT_PACED_TRAIN_SERVICE_INTERVAL,
        DEFAULT_PACED_TRAIN_SERVICE_WINDOW_HOURS,
        DEFAULT_PACED_TRAIN_SERVICE_WINDOW_MINUTES
      );
    });

    await test.step('Verify default values in the expanded header form', async () => {
      await headerPage.verifyExpandedFormFields({
        name: DEFAULT_PACED_TRAIN_NAME,
        departureDate: getTodayShortDate(),
        initialVelocity: '0',
        category: ROLLING_STOCK_DEFAULT_CATEGORY,
        rollingStock: ROLLING_STOCK_NAME,
        compositionCode: NO_COMPOSITION_CODE_VALUE,
        recoveryMargin: 'STANDARD',
        comfort: 'STANDARD',
        useElectricalProfiles: true,
        labels: [],
      });
    });

    await test.step('Verify the times and stops table reflects the default itinerary', async () => {
      await timesStopsTablePage.verifyTimesStopsDataSheetVisibility();
      await timesStopsTablePage.verifyDataRowCount(DEFAULT_PACED_TRAIN_ROW_COUNT);

      const westStationRow = timesStopsTablePage.getRow(0);
      await timesStopsTablePage.verifyRequestedArrivalValue(westStationRow, DEFAULT_MIDNIGHT_HOUR);
    });
  });

  /** *************** Test 2 **************** */
  test(
    'Create a paced train and verify its simulation results',
    { tag: '@smoke' },
    async ({
      browserName,
      itineraryModalPage,
      headerPage,
      scenarioTimetableSection,
      pacedTrainSection,
      opSimulationResultPage,
      timesStopsTablePage,
    }) => {
      // This test creates a paced train, edits every stop, and waits for a simulation after each
      // edit, so it can exceed the default timeout under heavy parallel test load.
      test.slow();

      await test.step('Open the itinerary modal and fill in a new paced train', async () => {
        await scenarioTimetableSection.openItineraryModal();
        await itineraryModalPage.fillRollingStock(dualModeRollingStockName);
        await itineraryModalPage.checkRollingStock(`${dualModeRollingStockName} - dual-mode`);
        await itineraryModalPage.checkCategory(FREIGHT_TRAIN.category);
        await itineraryModalPage.fillTrainName(NEW_PACED_TRAIN_SETTINGS.name);
        await itineraryModalPage.launchRocketSearch(NEW_PACED_TRAIN_ROUTE_SEARCH);
      });

      await test.step('Create a service (paced) train', async () => {
        await itineraryModalPage.createServiceTrain();
        await itineraryModalPage.checkTrainPresenceInTimetable(NEW_PACED_TRAIN_SETTINGS.name);
      });

      await test.step('Verify list contains exactly one paced train', async () => {
        await scenarioTimetableSection.verifyTrainSchedulesCount(1);
      });

      await test.step('Set the paced train departure date, cadence and window via the header', async () => {
        await pacedTrainSection.selectPacedTrainModel(0);
        await headerPage.expandHeader();
        await headerPage.setDepartureDate(NEW_PACED_TRAIN_DEPARTURE_DATE);
        await headerPage.setServiceCadenceMinutes(NEW_PACED_TRAIN_SETTINGS.interval);
        await headerPage.setServiceWindow(
          NEW_PACED_TRAIN_SERVICE_WINDOW_HOURS,
          NEW_PACED_TRAIN_SERVICE_WINDOW_MINUTES
        );
        await headerPage.collapseHeader();
      });

      await test.step('Fill Times & Stops table with initial inputs', async () => {
        await timesStopsTablePage.verifyTimesStopsDataSheetVisibility();
        await timesStopsTablePage.verifyDataRowCount(4);

        const westStationRow = timesStopsTablePage.getRow(0);
        await timesStopsTablePage.editRequestedArrival(
          westStationRow,
          WEST_STATION_REQUESTED_ARRIVAL
        );
        await timesStopsTablePage.waitForSimulation();
        await timesStopsTablePage.editRequestedMarginWithUnit(
          westStationRow,
          WEST_STATION_MARGIN_VALUE,
          WEST_STATION_MARGIN_UNIT
        );
        await timesStopsTablePage.waitForSimulation();

        const midWestStationRow = timesStopsTablePage.getRow(1);
        await timesStopsTablePage.editRequestedMarginWithUnit(
          midWestStationRow,
          MID_WEST_STATION_MARGIN_VALUE,
          MID_WEST_STATION_MARGIN_UNIT
        );
        await timesStopsTablePage.waitForSimulation();
        await timesStopsTablePage.editRequestedArrival(
          midWestStationRow,
          MID_WEST_STATION_REQUESTED_ARRIVAL
        );
        await timesStopsTablePage.waitForSimulation();
        await timesStopsTablePage.editStopDuration(
          midWestStationRow,
          MID_WEST_STATION_STOP_DURATION_DIGITS
        );
        await timesStopsTablePage.waitForSimulation();

        const midEastStationRow = timesStopsTablePage.getRow(2);
        await timesStopsTablePage.editRequestedArrival(
          midEastStationRow,
          MID_EAST_STATION_REQUESTED_ARRIVAL
        );
        await timesStopsTablePage.waitForSimulation();
        await timesStopsTablePage.editStopDuration(
          midEastStationRow,
          MID_EAST_STATION_STOP_DURATION_DIGITS
        );
        await timesStopsTablePage.waitForSimulation();
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
  }) => {
    await test.step('Set paced trains via API and reload to initialize list', async () => {
      await sendTrains(scenarioContext.trainScheduleSet.id, trains.slice(0, 7));
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
      await scenarioTimetableSection.checkToastHasBeenLaunched(
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
