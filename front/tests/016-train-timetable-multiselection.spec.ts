import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import { timetableItemProjectName, timetableItemStudyName } from './assets/constants/project-const';
import {
  TOTAL_TIMETABLE_ITEMS,
  TOTAL_PACED_TRAINS,
  TOTAL_TRAIN_SCHEDULES,
} from './assets/constants/timetable-items-count';
import test from './logging-fixture';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import sendTrainSchedules from './utils/train-schedule';
import type { CommonTranslations, TimetableFilterTranslations } from './utils/types';

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trainSchedulesJson: JSON = readJsonFile('./tests/assets/train-schedule/train_schedules.json');
const pacedTrainsJson: JSON = readJsonFile('./tests/assets/paced-train/paced_trains.json');

test.describe('Verify train schedule elements and filters', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll(
    'Setup project, study, infra and create scenario with timetableItems',
    async () => {
      project = await getProject(timetableItemProjectName);
      study = await getStudy(project.id, timetableItemStudyName);
      infra = await getInfra();
      scenarioItems = (
        await createScenario(
          generateUniqueName('timetable-item-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;
      await sendTrainSchedules(scenarioItems.timetable_id, trainSchedulesJson);
      await sendPacedTrains(scenarioItems.timetable_id, pacedTrainsJson);
    }
  );

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  test.beforeEach('Go to scenario page', async ({ page }) => {
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Select and delete all timetable items', async ({ page }) => {
    scenarioTimetableSection = new ScenarioTimetableSection(page);

    await test.step('Verify initial totals', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalTrainScheduleCount: TOTAL_TRAIN_SCHEDULES,
      });
    });

    await test.step('Select all timetable items', async () => {
      await scenarioTimetableSection.selectAllTimetableItems(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalTrainScheduleCount: TOTAL_TRAIN_SCHEDULES,
      });
    });

    await test.step('Delete all selected items', async () => {
      await scenarioTimetableSection.deleteAllTimetableItems();
    });

    await test.step('Verify deletion notifications', async () => {
      await scenarioTimetableSection.verifyAllTimetableItemsHaveBeenDeleted(
        TOTAL_TIMETABLE_ITEMS,
        frTranslations
      );
    });

    await test.step('Verify timetable is empty', async () => {
      await scenarioTimetableSection.verifyTimetableIsEmpty(frTranslations.timetable.noTrain);
    });
  });
});
