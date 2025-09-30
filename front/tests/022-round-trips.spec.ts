import type {
  Scenario,
  Project,
  Study,
  Infra,
  TrainSchedule,
  PacedTrain,
} from 'common/api/osrdEditoastApi';

import { timetableItemProjectName, timetableItemStudyName } from './assets/constants/project-const';
import {
  FirstPacedTrain,
  FirstTrainSchedule,
  SecondPacedTrain,
  SecondTrainSchedule,
  ThirdPacedTrain,
  ThirdTrainSchedule,
} from './assets/operation-studies/round-trips/round-trip-card';
import test from './logging-fixture';
import RoundTripPage from './pages/operational-studies/round-trips-page';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import sendTrainSchedules from './utils/train-schedule';
import type { RoundTripsModalTranslations } from './utils/types';

const frTranslations: RoundTripsModalTranslations = readJsonFile<{
  main: RoundTripsModalTranslations;
}>('public/locales/fr/operational-studies.json').main;

const trainSchedulesJson = readJsonFile<TrainSchedule[]>(
  './tests/assets/train-schedule/train_schedules.json'
);
const pacedTrainsJson = readJsonFile<PacedTrain[]>('./tests/assets/paced-train/paced_trains.json');

test.describe('Verify round trips', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  let roundTripPage: RoundTripPage;

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
  });

  test.beforeEach('Open scenario & round-trip modal', async ({ page }) => {
    roundTripPage = new RoundTripPage(page);
    await test.step('Create, open scenario and wait for infra to be loaded', async () => {
      scenarioItems = (
        await createScenario(
          generateUniqueName('round-trips-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;
      await Promise.all([
        sendTrainSchedules(scenarioItems.timetable_id, trainSchedulesJson.slice(18, 21)),
        sendPacedTrains(scenarioItems.timetable_id, pacedTrainsJson.slice(4, 7)),
      ]);

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await roundTripPage.removeViteOverlay();
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Open round trip page modal', async () => {
      await roundTripPage.openRoundTripModal();
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  test('Basic checks round trips', async () => {
    await test.step('Verify round trips elements are visible', async () => {
      await roundTripPage.verifyRoundTripsModalElements(
        frTranslations.roundTripsModal.todo,
        frTranslations.roundTripsModal.oneWays,
        frTranslations.roundTripsModal.roundTrips
      );
    });

    await test.step('Assert default column cards count', async () => {
      await roundTripPage.assertRoundTripColumnCounts({
        expectedToDoCount: 6,
        expectedOneWayCount: 0,
        expectedRoundTripCount: 0,
      });
    });
  });

  test('Verify round trip cards: paced trains and schedules', async () => {
    await test.step('First paced train - data & no tooltip', async () => {
      await roundTripPage.verifyRoundTripCardData({
        roundTripCardIndex: 0,
        expectedCard: FirstPacedTrain,
      });
      await roundTripPage.verifyNoTooltipDisplayed({ roundTripCardIndex: 0 });
    });

    await test.step('Second paced train - data & tooltip check', async () => {
      await roundTripPage.verifyRoundTripCardData({
        roundTripCardIndex: 1,
        expectedCard: SecondPacedTrain,
      });
      await roundTripPage.checkIntermediateStopsTooltip({ roundTripCardIndex: 1 });
    });

    await test.step('Third paced train - data & no tooltip', async () => {
      await roundTripPage.verifyRoundTripCardData({
        roundTripCardIndex: 2,
        expectedCard: ThirdPacedTrain,
      });
      await roundTripPage.verifyNoTooltipDisplayed({ roundTripCardIndex: 2 });
    });

    await test.step('First schedule - data & no tooltip', async () => {
      await roundTripPage.verifyRoundTripCardData({
        roundTripCardIndex: 3,
        expectedCard: FirstTrainSchedule,
      });
      await roundTripPage.verifyNoTooltipDisplayed({ roundTripCardIndex: 3 });
    });

    await test.step('Second schedule - data & tooltip check', async () => {
      await roundTripPage.verifyRoundTripCardData({
        roundTripCardIndex: 4,
        expectedCard: SecondTrainSchedule,
      });
      await roundTripPage.checkIntermediateStopsTooltip({ roundTripCardIndex: 4 });
    });

    await test.step('Third schedule - data, tooltip check & final no-tooltip', async () => {
      await roundTripPage.verifyRoundTripCardData({
        roundTripCardIndex: 5,
        expectedCard: ThirdTrainSchedule,
      });
      await roundTripPage.checkIntermediateStopsTooltip({ roundTripCardIndex: 5 });
    });
  });
  test('Cancel round trip items', async () => {
    await test.step('Move 1 item from To-do → One-way (not yet saved)', async () => {
      await roundTripPage.setTodoCardToOneWay({
        index: 3,
        toDoCount: 5,
        oneWayCount: 1,
        roundTripCount: 0,
      });
    });

    await test.step('Cancel changes and close the modal', async () => {
      await roundTripPage.cancelRoundTripModal();
    });

    await test.step('Reopen modal → no changes persisted', async () => {
      await roundTripPage.openRoundTripModal();
      await roundTripPage.assertRoundTripColumnCounts({
        expectedToDoCount: 6,
        expectedOneWayCount: 0,
        expectedRoundTripCount: 0,
      });
    });
  });

  test('Save round trip items', async () => {
    await test.step('Move 1 item from To-do → One-way', async () => {
      await roundTripPage.setTodoCardToOneWay({
        index: 0,
        toDoCount: 5,
        oneWayCount: 1,
        roundTripCount: 0,
      });
    });

    await test.step('Save changes and close the modal', async () => {
      await roundTripPage.saveRoundTripModal();
    });

    await test.step('Reopen modal → reflect the saved state', async () => {
      await roundTripPage.openRoundTripModal();
      await roundTripPage.assertRoundTripColumnCounts({
        expectedToDoCount: 5,
        expectedOneWayCount: 1,
        expectedRoundTripCount: 0,
      });
    });
  });

  test('Set One-way trip', async () => {
    await test.step('Filter item by name → verify filtered counts', async () => {
      await roundTripPage.searchForRoundTripsCard({
        searchText: 'train19',
        expectedToDoCount: 1,
        expectedOneWayCount: 0,
        expectedRoundTripCount: 0,
      });
    });

    await test.step('Convert the filtered item To-do → One-way', async () => {
      await roundTripPage.setTodoCardToOneWay({
        index: 0,
        toDoCount: 0,
        oneWayCount: 1,
        roundTripCount: 0,
      });
    });

    await test.step('Clear filter → restore the One-way item back to To-do', async () => {
      await roundTripPage.clearRoundTripSearchField({
        expectedToDoCount: 5,
        expectedOneWayCount: 1,
        expectedRoundTripCount: 0,
      });
      await roundTripPage.restoreOneWayCardToTodo({
        index: 0,
        toDoCount: 6,
        oneWayCount: 0,
        roundTripCount: 0,
      });
    });
  });

  test('Create and undo Round trips', async () => {
    await test.step('Pair first One-way with its return', async () => {
      await roundTripPage.pickReturnForOneWayCard({
        index: 2,
        pairingCardCount: 2,
        pairingCardIndex: 1,
        expectedToDoCount: 4,
        expectedOneWayCount: 0,
        expectedRoundTripCount: 1,
      });
    });

    await test.step('Pair second One-way with its return', async () => {
      await roundTripPage.pickReturnForOneWayCard({
        index: 1,
        pairingCardCount: 2,
        pairingCardIndex: 0,
        expectedToDoCount: 2,
        expectedOneWayCount: 0,
        expectedRoundTripCount: 2,
      });
    });

    await test.step('restore the most recent Round trip back to To-do', async () => {
      await roundTripPage.restoreRoundTripCardsToTodo({
        index: 1,
        toDoCount: 4,
        oneWayCount: 0,
        roundTripCount: 1,
      });
    });

    await test.step('restore the remaining Round trip all back to To-do', async () => {
      await roundTripPage.restoreRoundTripCardsToTodo({
        index: 0,
        toDoCount: 6,
        oneWayCount: 0,
        roundTripCount: 0,
      });
    });
  });
});
