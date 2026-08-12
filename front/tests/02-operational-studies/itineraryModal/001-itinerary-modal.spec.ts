import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra } from '../../utils/api-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import {
  COMPOSITION_CODE,
  NORTH_STATION,
  NORTH_STATION_MAIN_CODE,
  PLACEHOLDER,
  ROCKET_SEARCH_INPUT,
  ROLLING_STOCK_DEFAULT_CATEGORY,
  ROLLING_STOCK_NAME,
  ROLLING_STOCK_NAME_QUERY,
  SOUTH_STATION,
  SOUTH_STATION_MAIN_CODE,
  SOUTH_STATION_SUGGESTION,
  TRACK_NAME,
  TRAIN_NAME,
  WEST_STATION,
  WEST_STATION_SUGGESTION,
} from './itinerary-modal.consts';

test.describe('Itinerary Modal, Default ', { tag: ['@op', '@itinerary-modal'] }, () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page, scenarioTimetableSection }) => {
      ({ project, study, scenario } = await createScenario());

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      await waitForInfraStateToBeCached(infra.id);
      await scenarioTimetableSection.openItineraryModal();
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenario.name);
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
        await itineraryModalPage.checkItineraryModalHeader(PLACEHOLDER);
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
        await itineraryModalPage.selectRollingStock(
          ROLLING_STOCK_NAME_QUERY,
          ROLLING_STOCK_NAME,
          ROLLING_STOCK_DEFAULT_CATEGORY
        );
        await itineraryModalPage.selectCompositionCode(COMPOSITION_CODE);
        await itineraryModalPage.fillTrainName(TRAIN_NAME);
      });
      await test.step('Launch rocket search', async () => {
        await itineraryModalPage.launchRocketSearch(ROCKET_SEARCH_INPUT);
      });
      await test.step('Check itinerary rows created after rocket search', async () => {
        await itineraryModalPage.checkRowsCreationAfterRocketSearch(NORTH_STATION, SOUTH_STATION);
      });
      await test.step('Check path step marker presence on map', async () => {
        if (browserName === 'chromium') {
          await itineraryModalPage.checkMapUpdate(2);
        }
      });
      await test.step('Check itinerary reverse', async () => {
        await itineraryModalPage.checkItineraryReverse(SOUTH_STATION, NORTH_STATION);
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
        await itineraryModalPage.selectRollingStock(
          ROLLING_STOCK_NAME_QUERY,
          ROLLING_STOCK_NAME,
          ROLLING_STOCK_DEFAULT_CATEGORY
        );
        await itineraryModalPage.selectCompositionCode(COMPOSITION_CODE);
        await itineraryModalPage.fillTrainName(TRAIN_NAME);
      });
      await test.step('Search first operational point by name and check suggestions list', async () => {
        await itineraryModalPage.fillPathStepByName(0, WEST_STATION, WEST_STATION_SUGGESTION);
      });
      await test.step('Select first operational point from suggestions and check its value', async () => {
        await itineraryModalPage.selectFirstOpSuggestion();
        await itineraryModalPage.checkPathStepValue(0, WEST_STATION);
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
        await itineraryModalPage.checkPathStepValue(1, SOUTH_STATION);
      });
      await test.step('Insert an intermediate operational point between the two existing steps', async () => {
        await itineraryModalPage.insertIntermediatePathStep(1, NORTH_STATION_MAIN_CODE, 1);
      });
      await test.step('Check valid pathfinding result and itinerary displayed on map', async () => {
        if (browserName === 'chromium') {
          await itineraryModalPage.checkMapUpdate(3);
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
