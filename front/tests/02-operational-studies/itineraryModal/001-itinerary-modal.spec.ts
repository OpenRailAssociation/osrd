import { globalProjectName, globalStudyName } from '../../assets/constants/project-const';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import {
  COMPOSITION_CODE,
  NORTH_STATION_BV,
  NORTH_STATION_MAIN_CODE,
  PLACEHOLDER,
  ROCKET_SEARCH_INPUT,
  ROLLING_STOCK_DEFAULT_CATEGORY,
  ROLLING_STOCK_NAME,
  ROLLING_STOCK_NAME_QUERY,
  SOUTH_STATION_BV,
  SOUTH_STATION_MAIN_CODE,
  SOUTH_STATION_SUGGESTION,
  TRACK_NAME,
  TRAIN_NAME,
  WEST_STATION_BV,
  WEST_STATION_SUGGESTION,
} from './itinerary-modal.consts';

test.describe('Itinerary Modal, Default ', { tag: ['@op', '@itinerary-modal'] }, () => {
  setupScenarioFixture({
    scenarioNamePrefix: 'itinerary-modal-scenario',
    trains: [],
    scope: 'test',
    projectName: globalProjectName,
    studyName: globalStudyName,
  });

  test.beforeEach('Open the itinerary modal', async ({ scenarioTimetableSection }) => {
    await scenarioTimetableSection.openItineraryModal();
  });

  /** *************** Test 1 **************** */
  test(
    'Display the itinerary modal default structure',
    { tag: '@smoke' },
    async ({ itineraryModalPage }) => {
      await test.step('Empty default state of the itinerary modal', async () => {
        await itineraryModalPage.checkItineraryModalDefaultState();
      });
      await test.step('Check the header content of the itinerary modal', async () => {
        await itineraryModalPage.checkItineraryModalEmptyHeader(PLACEHOLDER);
      });
      await test.step('Default rocket search', async () => {
        await itineraryModalPage.checkItineraryModalEmptyRocket();
      });
      await test.step('Default itinerary row content', async () => {
        await itineraryModalPage.checkItineraryModalDefaultRowContent();
      });
      //TODO test on "Default control visibility"
    }
  );

  /** *************** Test 2 **************** */
  test('Add and remove empty itinerary rows', { tag: '@smoke' }, async ({ itineraryModalPage }) => {
    await test.step('Add itinerary rows', async () => {
      await itineraryModalPage.fillFirstPathStep('NS', 2);
      await itineraryModalPage.fillLastPathStep('SS', 3);
      await itineraryModalPage.addEmptyIntermediateRow(0, 4);
      await itineraryModalPage.addEmptyIntermediateRow(2, 5);
      await itineraryModalPage.checkPathStepCounterText(2, '3');
    });
    await test.step('Clear a path item field without removing the path item', async () => {
      await itineraryModalPage.clearPathStepValue(1);
      await itineraryModalPage.checkPathStepCounterText(2, '3');
    });
    await test.step('Check trailing placeholder', async () => {
      await itineraryModalPage.checkTrailingPlaceholder();
    });
    await test.step('Delete numbered rows', async () => {
      await itineraryModalPage.deleteNumberedRow(0, 4);
      await itineraryModalPage.deleteNumberedRow(1, 3);
      await itineraryModalPage.deleteNumberedRow(0, 2);
      await itineraryModalPage.checkTrailingPlaceholder();
    });
  });

  /** *************** Test 3 **************** */
  test(
    'Create a train with rocket pathfinding',
    { tag: '@smoke' },
    async ({ itineraryModalPage, browserName }) => {
      await test.step('Select rolling stock', async () => {
        await itineraryModalPage.fillRollingStock(ROLLING_STOCK_NAME_QUERY);
        await itineraryModalPage.checkRollingStock(ROLLING_STOCK_NAME);
        await itineraryModalPage.checkCategory(ROLLING_STOCK_DEFAULT_CATEGORY);
        await itineraryModalPage.selectAndCheckCompositionCode(COMPOSITION_CODE);
        await itineraryModalPage.fillAndCheckTrainName(TRAIN_NAME);
      });
      await test.step('Launch rocket search', async () => {
        await itineraryModalPage.launchRocketSearch(ROCKET_SEARCH_INPUT);
      });
      await test.step('Check itinerary rows created after rocket search', async () => {
        await itineraryModalPage.checkRowsCreationAfterRocketSearch(
          NORTH_STATION_BV,
          SOUTH_STATION_BV
        );
      });
      await test.step('Check path step marker presence on map', async () => {
        if (browserName === 'chromium') {
          await itineraryModalPage.checkPathStepMarkers([
            { name: NORTH_STATION_BV, index: 1 },
            { name: SOUTH_STATION_BV, index: 2 },
          ]);
        }
      });
      await test.step('Check itinerary reverse', async () => {
        await itineraryModalPage.checkItineraryReverse(SOUTH_STATION_BV, NORTH_STATION_BV);
      });
      await test.step('Check track selection and stops update', async () => {
        await itineraryModalPage.checkTrackSelectionAndStopsUpdate(1, TRACK_NAME, true);
      });
      await test.step('Create a train and verify presence in the timetable', async () => {
        await itineraryModalPage.createTrain();
        await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
      });
    }
  );

  /** *************** Test 4 **************** */
  test(
    'Create a train by filling the itinerary form manually',
    { tag: '@smoke' },
    async ({ itineraryModalPage, browserName }) => {
      await test.step('Select rolling stock and check automatic category assignment', async () => {
        await itineraryModalPage.fillRollingStock(ROLLING_STOCK_NAME_QUERY);
        await itineraryModalPage.checkRollingStock(ROLLING_STOCK_NAME);
        await itineraryModalPage.checkCategory(ROLLING_STOCK_DEFAULT_CATEGORY);
        await itineraryModalPage.selectAndCheckCompositionCode(COMPOSITION_CODE);
        await itineraryModalPage.fillAndCheckTrainName(TRAIN_NAME);
      });
      await test.step('Search first operational point by name and check suggestions list', async () => {
        await itineraryModalPage.fillPathStepByName(0, WEST_STATION_BV, WEST_STATION_SUGGESTION);
      });
      await test.step('Select first operational point from suggestions and check its value', async () => {
        await itineraryModalPage.selectFirstOpSuggestion();
        await itineraryModalPage.checkPathStepValue(0, WEST_STATION_BV);
      });
      await test.step('Search for second operational point by trigram and check suggestions list', async () => {
        await itineraryModalPage.fillPathStepByName(
          1,
          SOUTH_STATION_MAIN_CODE,
          SOUTH_STATION_SUGGESTION
        );
      });
      await test.step('Select second operational point from suggestions and check its value', async () => {
        await itineraryModalPage.selectFirstOpSuggestion();
        await itineraryModalPage.checkPathStepValue(1, SOUTH_STATION_BV);
      });
      await test.step('Insert an intermediate operational point between the two existing steps', async () => {
        await itineraryModalPage.insertIntermediatePathStep(1, NORTH_STATION_MAIN_CODE, 1);
      });
      await test.step('Check valid pathfinding result and itinerary displayed on map', async () => {
        if (browserName === 'chromium') {
          await itineraryModalPage.checkPathStepMarkers([
            { name: WEST_STATION_BV, index: 1 },
            { name: NORTH_STATION_BV, index: 2 },
            { name: SOUTH_STATION_BV, index: 3 },
          ]);
        }
      });
      await test.step('Select track and update stop', async () => {
        await itineraryModalPage.checkTrackSelectionAndStopsUpdate(1, TRACK_NAME, false);
      });
      await test.step('Create a train and verify presence in the timetable', async () => {
        await itineraryModalPage.createTrain();
        await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
      });
    }
  );
});
