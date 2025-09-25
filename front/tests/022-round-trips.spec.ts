import type {
  Scenario,
  Project,
  Study,
  Infra,
  TrainSchedule,
  PacedTrain,
} from 'common/api/osrdEditoastApi';

import { timetableItemProjectName, timetableItemStudyName } from './assets/constants/project-const';
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
});
