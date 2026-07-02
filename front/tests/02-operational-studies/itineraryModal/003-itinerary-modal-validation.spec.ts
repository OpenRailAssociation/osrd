import { expect } from '@playwright/test';

import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra } from '../../utils/api-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import {
  ROLLING_STOCK_NAME,
  ROLLING_STOCK_NAME_QUERY,
  TRAIN_NAME,
  NORTH_STATION,
  SOUTH_STATION,
  MISSING_DESTINATION_ERROR,
  UNKNOWN_PR_VALUE,
  SOUTH_STATION_WITHOUT_SECONDARY_CODE,
  SOUTH_STATION_WRONG_SECONDARY_CODE,
  SOUTH_STATION_SUGGESTION,
  TRACK_NAME_2,
  MID_EAST_STATION,
  MISSING_BLOCK_BANNER,
  MISSING_BLOCK,
  NORTH_EAST_STATION,
  IMPROBABLE_RS,
  UNRECOGNIZED_TRIGRAM,
  CATEGORY_MISMATCH_WARNING,
  ROCKET_SEARCH_INPUT,
  ELECTRIC_RS,
} from './itinerary-modal.consts';

test.describe('Itinerary modal validation ', { tag: ['@op', '@itinerary-modal'] }, () => {
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
    'Validate mandatory fields before creating a valid train',
    { tag: '@smoke' },
    async ({ itineraryModalPage }) => {
      await test.step('Click Next on a fully empty form and check train name error', async () => {
        await itineraryModalPage.clickNextButton();
        await itineraryModalPage.checkTrainNameRequiredError();
        await itineraryModalPage.checkFormIsOpen();
      });

      await test.step('Fill only the train name and check the form is still invalid', async () => {
        await itineraryModalPage.fillTrainName(TRAIN_NAME);
        await itineraryModalPage.clickNextButton();
        await itineraryModalPage.checkFormIsOpen();
      });

      await test.step('Fill origin and destination', async () => {
        await itineraryModalPage.fillFirstPathStep(NORTH_STATION, 2);
        await itineraryModalPage.fillLastPathStep(SOUTH_STATION, 3, SOUTH_STATION_SUGGESTION);
        await itineraryModalPage.checkPathStepValue(0, NORTH_STATION);
        await itineraryModalPage.checkPathStepValue(1, SOUTH_STATION);
      });

      await test.step('Remove destination to keep only one valid point and check the map', async () => {
        await itineraryModalPage.deleteNumberedRow(1, 2);
        await itineraryModalPage.checkPathStepMarkers([{ name: NORTH_STATION, index: 1 }]);
      });

      await test.step('Click Next with only one valid point and check destination error', async () => {
        await itineraryModalPage.clickNextButton();
        await itineraryModalPage.checkMissingStepError(MISSING_DESTINATION_ERROR);
        await itineraryModalPage.checkFormIsOpen();
      });

      await test.step('Add a second valid point and check pathfinding becomes possible', async () => {
        await itineraryModalPage.fillLastPathStep(SOUTH_STATION, 3, SOUTH_STATION_SUGGESTION);
        await itineraryModalPage.checkPathStepMarkers([
          { name: NORTH_STATION, index: 1 },
          { name: SOUTH_STATION, index: 2 },
        ]);
      });

      await test.step('Select a rolling stock', async () => {
        await itineraryModalPage.fillRollingStock(ROLLING_STOCK_NAME_QUERY);
        await itineraryModalPage.checkRollingStock(ROLLING_STOCK_NAME);
      });

      await test.step('Submit the now-valid form and check the modal closes', async () => {
        await itineraryModalPage.createTrain();
        await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
      });
    }
  );

  /** *************** Test 2 **************** */

  test('Handle invalid itinerary inputs in the form', async ({
    itineraryModalPage,
    opSimulationResultPage,
    ngePage,
  }) => {
    // We can't yet add invalid ops from the itinerary modal, so we will have to create 2 invalid ops from NGE.
    await test.step('Add invalid operational points from NGE and check invalid row state', async () => {
      await itineraryModalPage.cancelItineraryEdition();
      await opSimulationResultPage.enableMacroViewWithDefaultTrainList();
      await ngePage.createNode({ x: 50, y: 400 }, 'ABC', 'Origin');
      await expect(ngePage.nodeCards).toHaveCount(1);
      await ngePage.createNode({ x: 250, y: 400 }, 'DEF', 'Destination');
      await expect(ngePage.nodeCards).toHaveCount(2);

      await ngePage.connectNodesByIndex(0, 1);
      await expect(ngePage.trainDetailsGroup).toBeVisible();
      await ngePage.setTrainBasics({ name: 'Train1' });
      await ngePage.closeDetailsDialogIfVisible();
      await expect(ngePage.trainDetailsGroup).toBeHidden();
      await expect(ngePage.trainLines).toHaveCount(1);

      await itineraryModalPage.launchEditTrain();

      await itineraryModalPage.fillRollingStock(ROLLING_STOCK_NAME_QUERY);
      await itineraryModalPage.fillTrainName(TRAIN_NAME);
      await itineraryModalPage.replacePathStepValue(1, UNKNOWN_PR_VALUE);
      await itineraryModalPage.checkInvalidPathStep(1);
      await itineraryModalPage.checkInvalidPathStepMessage(1, UNRECOGNIZED_TRIGRAM);
    });

    await test.step('Replace the invalid PR with a valid PR requiring a secondary code and check the recognized point', async () => {
      await itineraryModalPage.fillPathStepByName(1, SOUTH_STATION, SOUTH_STATION_SUGGESTION);
      await itineraryModalPage.selectFirstOpSuggestion();
      await itineraryModalPage.checkPathStepValue(1, SOUTH_STATION);
    });

    await test.step('Remove the prefilled secondary code and check the fallback behavior', async () => {
      await itineraryModalPage.clearChValue(1, SOUTH_STATION_WITHOUT_SECONDARY_CODE);
      await itineraryModalPage.checkPathStepValue(1, SOUTH_STATION);
      await itineraryModalPage.checkPathStepValue(1, SOUTH_STATION);
    });

    await test.step('Type a nonexistent secondary code and check the input reset behavior', async () => {
      await itineraryModalPage.replacePathStepValue(1, SOUTH_STATION_WRONG_SECONDARY_CODE);
      await itineraryModalPage.checkPathStepValue(1, '');
    });
  });

  /** *************** Test 3 **************** */

  test('Handle invalid route computation and compatibility states', async ({
    itineraryModalPage,
  }) => {
    await test.step('Fill a valid itinerary as a base', async () => {
      await itineraryModalPage.fillRollingStock(ROLLING_STOCK_NAME_QUERY);
      await itineraryModalPage.fillTrainName(TRAIN_NAME);
      await itineraryModalPage.fillFirstPathStep(MID_EAST_STATION, 2);
      await itineraryModalPage.fillLastPathStep(SOUTH_STATION, 3, SOUTH_STATION_SUGGESTION);
      await itineraryModalPage.checkPathStepMarkers([
        { name: MID_EAST_STATION, index: 1 },
        { name: SOUTH_STATION, index: 2 },
      ]);
    });

    await test.step('Select an incompatible track for a valid PR and check the point stays recognized while the route becomes invalid', async () => {
      await itineraryModalPage.selectIncompatibleTrack(0, TRACK_NAME_2);
      await itineraryModalPage.checkMapIncompatibilityDetails(MISSING_BLOCK_BANNER);
      await itineraryModalPage.checkPathStepValue(1, SOUTH_STATION);
    });

    await test.step('Submit despite invalid route state and check train creation failure', async () => {
      await itineraryModalPage.createTrain();
      await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
      await itineraryModalPage.checkInvalidReasonInTimetable(MISSING_BLOCK);
    });

    await test.step('Enter a recognized but non-computable combination of points and relaunch pathfinding', async () => {
      await itineraryModalPage.launchEditTrain();
      await itineraryModalPage.replacePathStepValueWithSuggestion(1, 'NS');
      await itineraryModalPage.checkPathStepValue(1, NORTH_STATION);
      await itineraryModalPage.replacePathStepValueWithSuggestion(2, 'NE');
      await itineraryModalPage.checkPathStepValue(2, NORTH_EAST_STATION);
    });

    await test.step('Check the pathfinding failure error banner and no complete path on the map', async () => {
      await itineraryModalPage.checkMissingStepError(MISSING_BLOCK_BANNER);
      await itineraryModalPage.checkPathStepMarkers([
        { name: MID_EAST_STATION, index: 1 },
        { name: NORTH_STATION, index: 2 },
        { name: NORTH_EAST_STATION, index: 3 },
      ]);
    });

    await test.step('Submit despite the failure and check train creation failure', async () => {
      await itineraryModalPage.submitEdit();
      await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
      await itineraryModalPage.checkInvalidReasonInTimetable(MISSING_BLOCK);
    });

    await test.step('Fix the itinerary then select a rolling stock incompatible with the infrastructure', async () => {
      await itineraryModalPage.launchEditTrain();
      await itineraryModalPage.replacePathStepValueWithSuggestion(1, SOUTH_STATION);
      await itineraryModalPage.checkPathStepMarkers([
        { name: MID_EAST_STATION, index: 1 },
        { name: SOUTH_STATION, index: 2 },
        { name: NORTH_EAST_STATION, index: 3 },
      ]);
      await itineraryModalPage.fillRollingStock(IMPROBABLE_RS);
      await itineraryModalPage.checkRollingStock(IMPROBABLE_RS);
    });
  });

  /** *************** Test 4 **************** */

  test('Display category / rolling stock warning without blocking submission', async ({
    itineraryModalPage,
  }) => {
    await test.step('Select a category, then a rolling stock incompatible with the category and check the warning', async () => {
      await itineraryModalPage.selectAndCheckCategory('main:REGIONAL_TRAIN');
      await itineraryModalPage.fillRollingStock(IMPROBABLE_RS);
      await itineraryModalPage.fillTrainName(TRAIN_NAME);
      await itineraryModalPage.launchRocketSearch(ROCKET_SEARCH_INPUT);
      await itineraryModalPage.checkRollingStock(IMPROBABLE_RS);
      await itineraryModalPage.checkIncompatibleCategoryWarning(CATEGORY_MISMATCH_WARNING);
    });
    await test.step('Submit the form and check the train is created despite the warning', async () => {
      await itineraryModalPage.createTrain();
      await itineraryModalPage.checkTrainPresenceInTimetable(TRAIN_NAME);
    });
    await test.step('Replace with a coherent rolling stock and check the warning disappears', async () => {
      await itineraryModalPage.launchEditTrain();
      await itineraryModalPage.fillRollingStock(ELECTRIC_RS);
      await itineraryModalPage.checkNoWarningBanner();
    });
  });
});
