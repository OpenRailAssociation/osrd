import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import {
  FirstPacedTrain,
  FirstUniqueTrain,
  SecondPacedTrain,
  SecondUniqueTrain,
  ThirdPacedTrain,
  ThirdUniqueTrain,
} from '../../assets/operation-studies/round-trips/round-trip-card';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type { RoundTripsModalTranslations } from '../../utils/types';

const frTranslations: RoundTripsModalTranslations = readJsonFile<{
  main: RoundTripsModalTranslations;
}>('public/locales/fr/operational-studies.json').main;

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe(
  'Round trips management',
  { tag: ['@op', '@train-schedules', '@round-trips'] },
  () => {
    let project: Project;
    let study: Study;
    let scenarioItems: Scenario;
    let infra: Infra;

    test.beforeAll('Fetch project, study and infrastructure', async () => {
      project = await getProject(trainScheduleProjectName);
      study = await getStudy(project.id, trainScheduleStudyName);
      infra = await getInfra();
    });

    test.beforeEach('Open scenario & round-trip modal', async ({ page, roundTripPage }) => {
      await test.step('Create, open scenario and wait for infra to be loaded', async () => {
        const { scenario, trainScheduleSet } = await createScenario(
          generateUniqueName('round-trips-scenario'),
          project.id,
          study.id,
          infra.id
        );
        scenarioItems = scenario;

        const selectedTrains = [...trains.slice(4, 7), ...trains.slice(25, 28)];
        await sendTrains(trainScheduleSet.id, selectedTrains);

        await page.goto(
          `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
        );
        await waitForInfraStateToBeCached(infra.id);
      });
      await test.step('Open round trip page modal', async () => {
        await roundTripPage.openRoundTripModal();
      });
    });

    test.afterEach('Delete the created scenario', async () => {
      await deleteScenario(study.id, scenarioItems.name);
    });

    /** *************** Test 1 **************** */
    test('Basic checks round trips', async ({ roundTripPage }) => {
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

    /** *************** Test 2 **************** */
    test(
      'Verify round trip cards: paced trains and unique trains',
      { tag: '@smoke' },
      async ({ roundTripPage }) => {
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

        await test.step('First unique train - data & no tooltip', async () => {
          await roundTripPage.verifyRoundTripCardData({
            roundTripCardIndex: 3,
            expectedCard: FirstUniqueTrain,
          });
          await roundTripPage.verifyNoTooltipDisplayed({ roundTripCardIndex: 3 });
        });

        await test.step('Second unique train - data & tooltip check', async () => {
          await roundTripPage.verifyRoundTripCardData({
            roundTripCardIndex: 4,
            expectedCard: SecondUniqueTrain,
          });
          await roundTripPage.checkIntermediateStopsTooltip({ roundTripCardIndex: 4 });
        });

        await test.step('Third unique train - data, tooltip check & final no-tooltip', async () => {
          await roundTripPage.verifyRoundTripCardData({
            roundTripCardIndex: 5,
            expectedCard: ThirdUniqueTrain,
          });
          await roundTripPage.checkIntermediateStopsTooltip({ roundTripCardIndex: 5 });
        });
      }
    );

    /** *************** Test 3 **************** */
    test('Cancel round trip items', async ({ roundTripPage }) => {
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

    /** *************** Test 4 **************** */
    test('Save round trip items', { tag: '@smoke' }, async ({ roundTripPage }) => {
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

    /** *************** Test 5 **************** */
    test('Set One-way trip', async ({ roundTripPage }) => {
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

    /** *************** Test 6 **************** */
    test('Create and undo Round trips', async ({ roundTripPage }) => {
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

      await test.step('Restore the most recent Round trip back to To-do', async () => {
        await roundTripPage.restoreRoundTripCardsToTodo({
          index: 1,
          toDoCount: 4,
          oneWayCount: 0,
          roundTripCount: 1,
        });
      });

      await test.step('Restore the remaining Round trip all back to To-do', async () => {
        await roundTripPage.restoreRoundTripCardsToTodo({
          index: 0,
          toDoCount: 6,
          oneWayCount: 0,
          roundTripCount: 0,
        });
      });
    });
  }
);
