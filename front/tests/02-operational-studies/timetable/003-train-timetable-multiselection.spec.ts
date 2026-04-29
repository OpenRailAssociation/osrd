import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import {
  TOTAL_TRAIN_SCHEDULES,
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
} from '../../assets/constants/train-schedules-count';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type { CommonTranslations, TimetableFilterTranslations } from '../../utils/types';

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe('Train schedules multiselection', { tag: ['@op', '@train-schedules'] }, () => {
  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll(
    'Setup project, study, infra and create scenario with trainSchedules',
    async () => {
      project = await getProject(trainScheduleProjectName);
      study = await getStudy(project.id, trainScheduleStudyName);
      infra = await getInfra();
      const { scenario, trainScheduleSet } = await createScenario(
        generateUniqueName('train-schedule-scenario'),
        project.id,
        study.id,
        infra.id
      );
      scenarioItems = scenario;

      await sendTrains(trainScheduleSet.id, trains);
    }
  );

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenarioItems.name);
  });

  test.beforeEach('Go to scenario page', async ({ page }) => {
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Select and delete all train schedules', async ({ scenarioTimetableSection }) => {
    await test.step('Verify initial totals', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
      });
    });

    await test.step('Select all train schedules', async () => {
      await scenarioTimetableSection.selectAllTrainSchedulesAndVerifySelection(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
      });
    });

    await test.step('Delete all selected train schedules', async () => {
      await scenarioTimetableSection.deleteAllTrainSchedules();
    });

    await test.step('Verify deletion notifications', async () => {
      await scenarioTimetableSection.verifyAllTrainSchedulesHaveBeenDeleted(
        TOTAL_TRAIN_SCHEDULES,
        frTranslations
      );
    });

    await test.step('Verify timetable is empty', async () => {
      await scenarioTimetableSection.verifyTimetableIsEmpty(
        frTranslations.timetable.noTrainSchedule
      );
    });
  });
});
