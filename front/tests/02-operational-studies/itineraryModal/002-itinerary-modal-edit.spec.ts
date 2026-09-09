import type { Infra, Project, Scenario, Study, TrainSchedule } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import {
  COMPOSITION_CODE,
  NORTH_STATION_BV,
  NORTH_STATION_MAIN_CODE,
  ROLLING_STOCK_NAME,
  SOUTH_STATION_BV,
  TRACK_NAME,
  TRAIN_NAME,
  REGIONAL_CATEGORY,
  TRAIN_NAME_EDITED,
  SOUTH_EAST_STATION_BV,
  SOUTH_EAST_STATION_MAIN_CODE,
  ELECTRIC_RS,
  INTERCITY_CATEGORY,
  INTERCITY_TRAIN_HEADER,
  NORTH_STATION,
  SOUTH_STATION,
} from './itinerary-modal.consts';

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');
const trainSubset: TrainSchedule[] = trains.slice(-1);

test.describe('Itinerary Modal, Edition ', { tag: ['@op', '@itinerary-modal'] }, () => {
  let project: Project;

  let study: Study;

  let scenario: Scenario;

  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',

    async ({ page, itineraryModalPage }) => {
      const { trainScheduleSet, ...scenarioSetup } = await createScenario();
      ({ project, study, scenario } = scenarioSetup);

      await sendTrains(trainScheduleSet.id, trainSubset);

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      await waitForInfraStateToBeCached(infra.id);
      await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
      await itineraryModalPage.launchEditTrain();
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
  });

  /** *************** Test 1 **************** */

  test(
    'Display the edit itinerary modal default structure',
    { tag: '@smoke' },
    async ({ itineraryModalPage, browserName }) => {
      await test.step('Check itinerary modal default state on edit mode', async () => {
        await itineraryModalPage.checkItineraryModalDefaultState('edit');
      });
      await test.step('Check the header content of the itinerary modal on edit mode', async () => {
        await itineraryModalPage.checkItineraryModalHeader(
          REGIONAL_CATEGORY,
          ROLLING_STOCK_NAME,
          COMPOSITION_CODE,
          TRAIN_NAME
        );
      });
      await test.step('Check itinerary form prefilled with existing OPs in order', async () => {
        await itineraryModalPage.checkItineraryModalPrefilledRows(
          NORTH_STATION_BV,
          SOUTH_STATION_BV
        );
      });
      await test.step('Check path step markers in the map', async () => {
        if (browserName === 'chromium') {
          await itineraryModalPage.checkPathStepMarkers([
            { name: NORTH_STATION_BV, index: 1 },
            { name: SOUTH_STATION_BV, index: 2 },
          ]);
        }
      });
      await test.step('Check finale unumbered row', async () => {
        await itineraryModalPage.checkTrailingPlaceholder();
      });
    }
  );

  /** *************** Test 2 **************** */

  test(
    'Edit and save an existing train from the itinerary modal',
    { tag: '@smoke' },
    async ({ itineraryModalPage, browserName }) => {
      await test.step('Update rolling stock', async () => {
        await itineraryModalPage.fillRollingStock(ELECTRIC_RS);
        await itineraryModalPage.selectAndCheckCategory(INTERCITY_CATEGORY);
        await itineraryModalPage.fillTrainName(TRAIN_NAME_EDITED);
        await itineraryModalPage.checkItineraryModalHeader(
          INTERCITY_CATEGORY,
          ELECTRIC_RS,
          COMPOSITION_CODE,
          TRAIN_NAME_EDITED
        );
      });
      await test.step('Update track and stop', async () => {
        await itineraryModalPage.checkTrackSelectionAndStopsUpdate(1, TRACK_NAME, true);
      });
      await test.step('Check map update after track edition', async () => {
        if (browserName === 'chromium') {
          await itineraryModalPage.checkPathStepMarkers([
            { name: NORTH_STATION_BV, index: 1 },
            { name: `${SOUTH_STATION_BV} · ${TRACK_NAME}`, index: 2 },
          ]);
        }
      });
      await test.step('Insert a path step in the itinerary', async () => {
        await itineraryModalPage.insertIntermediatePathStep(1, NORTH_STATION_MAIN_CODE, 1);
        await itineraryModalPage.checkPathStepValue(2, SOUTH_STATION_BV);
        if (browserName === 'chromium') {
          await itineraryModalPage.checkPathStepMarkers([
            { name: NORTH_STATION_BV, index: 1 },
            { name: NORTH_STATION_BV, index: 2 },
            { name: `${SOUTH_STATION_BV} · ${TRACK_NAME}`, index: 3 },
          ]);
        }
        await itineraryModalPage.checkNumberedRowsCount(4);
      });
      await test.step('remove pathStep and check rows and map update', async () => {
        await itineraryModalPage.removePathStepAt(0);
        await itineraryModalPage.checkPathStepValue(0, NORTH_STATION_BV);
        if (browserName === 'chromium') {
          await itineraryModalPage.checkPathStepMarkers([
            { name: NORTH_STATION_BV, index: 1 },
            { name: `${SOUTH_STATION_BV} · ${TRACK_NAME}`, index: 2 },
          ]);
        }
      });
      await test.step('Submit itinerary edition and check train update', async () => {
        await itineraryModalPage.submitEdit();
        await itineraryModalPage.checkTrainPresenceInTimetable('Test train edited');
        await itineraryModalPage.checkTrainHeaderDetails(
          INTERCITY_TRAIN_HEADER,
          ELECTRIC_RS,
          COMPOSITION_CODE
        );
        await itineraryModalPage.checkManchetteOriginAndDestination(NORTH_STATION, SOUTH_STATION);
      });
    }
  );

  /** *************** Test 3 **************** */

  test(
    'Edit and cancel changes on an existing train from the itinerary modal',
    { tag: '@smoke' },
    async ({ itineraryModalPage }) => {
      await test.step('Update rolling stock', async () => {
        await itineraryModalPage.fillRollingStock(ELECTRIC_RS);
        await itineraryModalPage.selectAndCheckCategory(INTERCITY_CATEGORY);
        await itineraryModalPage.fillTrainName(TRAIN_NAME_EDITED);
        await itineraryModalPage.checkItineraryModalHeader(
          INTERCITY_CATEGORY,
          ELECTRIC_RS,
          COMPOSITION_CODE,
          TRAIN_NAME_EDITED
        );
      });
      await test.step('Update itinerary rows', async () => {
        await itineraryModalPage.updateItineraryRows(
          SOUTH_EAST_STATION_MAIN_CODE,
          SOUTH_EAST_STATION_BV
        );
      });
      await test.step('Cancel edition', async () => {
        await itineraryModalPage.cancelItineraryEdition();
      });
      await test.step('Re open the itinerary modal to check changes are not saved', async () => {
        await itineraryModalPage.launchEditTrain();
        await itineraryModalPage.checkItineraryModalHeader(
          REGIONAL_CATEGORY,
          ROLLING_STOCK_NAME,
          COMPOSITION_CODE,
          TRAIN_NAME
        );
      });
    }
  );
});
