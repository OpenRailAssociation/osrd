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
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import sendTrainSchedules from './utils/train-schedule';
import type {
  CommonTranslations,
  ManageTimetableItemTranslations,
  TimetableFilterTranslations,
} from './utils/types';

const frManageTimetableItemTranslations: ManageTimetableItemTranslations = readJsonFile<{
  manageTimetableItem: ManageTimetableItemTranslations;
}>('public/locales/fr/operational-studies.json').manageTimetableItem;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frManageTimetableItemTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trainSchedulesJson = readJsonFile<TrainSchedule[]>(
  './tests/assets/train-schedule/train_schedules.json'
);
const pacedTrainsJson = readJsonFile<PacedTrain[]>('./tests/assets/paced-train/paced_trains.json');

const TIME_WINDOW = '240';
const INTERVAL = '20';
const EDITED_PACED_TRAIN_NAME = 'Paced train edited';

test.describe('Edit train schedules and paced trains', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;
  let operationalStudiesPage: OperationalStudiesPage;
  let pacedTrainSection: PacedTrainSection;

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
  });

  test.beforeEach(
    'Setup scenario with one train schedule and one paced train',
    async ({ page }) => {
      [pacedTrainSection, scenarioTimetableSection, operationalStudiesPage] = [
        new PacedTrainSection(page),
        new ScenarioTimetableSection(page),
        new OperationalStudiesPage(page),
      ];
      scenarioItems = (
        await createScenario(
          generateUniqueName('edit-train-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;
      await sendTrainSchedules(
        scenarioItems.timetable_id,
        JSON.parse(JSON.stringify(trainSchedulesJson.slice(0, 1)))
      );
      await sendPacedTrains(
        scenarioItems.timetable_id,
        JSON.parse(JSON.stringify(pacedTrainsJson.slice(0, 1)))
      );

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  /** *************** Test 1 **************** */
  test('Edit a paced train', async () => {
    await test.step('Open paced train edition page', async () => {
      await pacedTrainSection.openPacedTrainEditor();
    });

    await test.step('Update paced train properties', async () => {
      await operationalStudiesPage.setTimeWindow(TIME_WINDOW);
      await operationalStudiesPage.setInterval(INTERVAL);
      await operationalStudiesPage.setTimetableItemName(EDITED_PACED_TRAIN_NAME);
    });

    await test.step('Save paced train and verify toast notification', async () => {
      await operationalStudiesPage.updateTimetableItem(frTranslations.updatePacedTrain);
      await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.pacedTrainUpdated);
    });

    await test.step('Verify timetable labels and paced train details', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalTrainScheduleCount: 1,
      });
      await pacedTrainSection.verifyPacedTrainItemDetails(
        {
          name: EDITED_PACED_TRAIN_NAME,
          startTime: '03:00',
          labels: [],
          timeWindow: TIME_WINDOW,
          interval: INTERVAL,
          expectedOccurrencesCount: 12,
        },
        0,
        { pacedTrainCardAlreadyOpen: true }
      );
    });
  });

  /** *************** Test 2 **************** */
  test('Turn paced train into train schedule', async () => {
    await test.step('Edit paced train', async () => {
      await pacedTrainSection.openPacedTrainEditor();
    });

    await test.step('Convert paced train to train schedule', async () => {
      await operationalStudiesPage.turnPacedTrainIntoTrainSchedule(frTranslations);
      await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.pacedTrainUpdated);
    });

    await test.step('Verify timetable labels after conversion', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 0,
        totalTrainScheduleCount: 2,
      });
    });
  });

  /** *************** Test 3 **************** */
  test('Turn a train schedule into a paced train', async () => {
    await test.step('Edit train schedule at index 1', async () => {
      await scenarioTimetableSection.editTimetableItem(1);
    });

    await test.step('Convert train schedule to paced train', async () => {
      await operationalStudiesPage.turnTrainScheduleIntoPacedTrain(frTranslations);
      await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.trainScheduleUpdated);
    });

    await test.step('Verify timetable labels after conversion', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 2,
        totalTrainScheduleCount: 0,
      });
    });
  });
});
