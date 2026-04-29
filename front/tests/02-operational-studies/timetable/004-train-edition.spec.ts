import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import { FREIGHT_TRAIN, HIGH_SPEED_TRAIN_COLOR } from '../../assets/operation-studies/train-const';
import {
  PACED_TRAIN_OCCURRENCE_COUNT,
  EDITED_PACED_TRAIN_NAME,
  INTERVAL,
  TIME_WINDOW,
} from '../../assets/paced-train/const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type {
  CommonTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';

const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frManageTrainScheduleTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe('Train edition', { tag: ['@op', '@paced-trains', '@unique-trains'] }, () => {
  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
    infra = await getInfra();
  });

  test.beforeEach('Setup scenario with one unique train and one paced train', async ({ page }) => {
    const { scenario, trainScheduleSet } = await createScenario(
      generateUniqueName('edit-train-scenario'),
      project.id,
      study.id,
      infra.id
    );
    scenarioItems = scenario;

    const selectedTrains = [...trains.slice(0, 1), ...trains.slice(7, 8)];
    await sendTrains(trainScheduleSet.id, selectedTrains);

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenarioItems.name);
  });

  /** *************** Test 1 **************** */
  test('Edit a paced train', async ({
    scenarioTimetableSection,
    operationalStudiesPage,
    pacedTrainSection,
  }) => {
    await test.step('Open paced train edition page', async () => {
      await pacedTrainSection.verifyOccurrencesCount(
        PACED_TRAIN_OCCURRENCE_COUNT,
        0,
        HIGH_SPEED_TRAIN_COLOR
      );
      await pacedTrainSection.openPacedTrainEditor();
    });

    await test.step('Update paced train properties', async () => {
      await operationalStudiesPage.setTimeWindow(TIME_WINDOW);
      await operationalStudiesPage.setInterval(INTERVAL);
      await operationalStudiesPage.setTrainScheduleName(EDITED_PACED_TRAIN_NAME);
      await operationalStudiesPage.selectCategory(FREIGHT_TRAIN.category);
    });

    await test.step('Save paced train and verify toast notification', async () => {
      await operationalStudiesPage.updateTrainSchedule(frTranslations.updatePacedTrain);
      await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.pacedTrainUpdated);
    });

    await test.step('Verify timetable labels and paced train details', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalUniqueTrainCount: 1,
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
        { pacedTrainCardAlreadyOpen: true, occurrenceColor: FREIGHT_TRAIN.color }
      );
    });
  });

  /** *************** Test 2 **************** */
  test('Turn paced train into unique train', async ({
    scenarioTimetableSection,
    operationalStudiesPage,
    pacedTrainSection,
  }) => {
    await test.step('Edit paced train', async () => {
      await pacedTrainSection.openPacedTrainEditor();
    });

    await test.step('Convert paced train to unique train', async () => {
      await operationalStudiesPage.turnPacedTrainIntoUniqueTrain(frTranslations);
      await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.pacedTrainUpdated);
    });

    await test.step('Verify timetable labels after conversion', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: 0,
        totalUniqueTrainCount: 2,
      });
    });
  });

  /** *************** Test 3 **************** */
  test('Turn a unique train into a paced train', async ({
    scenarioTimetableSection,
    operationalStudiesPage,
  }) => {
    await test.step('Edit unique train at index 1', async () => {
      await scenarioTimetableSection.editTrainSchedule(1);
    });

    await test.step('Convert unique train to paced train', async () => {
      await operationalStudiesPage.turnUniqueTrainIntoPacedTrain(frTranslations);
      await operationalStudiesPage.checkToastHasBeenLaunched(frTranslations.uniqueTrainUpdated);
    });

    await test.step('Verify timetable labels after conversion', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: 2,
        totalUniqueTrainCount: 0,
      });
    });
  });
});
