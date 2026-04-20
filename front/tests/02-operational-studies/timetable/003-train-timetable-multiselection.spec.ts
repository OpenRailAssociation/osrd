import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  timetableItemProjectName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import {
  TOTAL_TIMETABLE_ITEMS,
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
} from '../../assets/constants/timetable-items-count';
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

test.describe('Timetable items multiselection', { tag: ['@op', '@timetable-items'] }, () => {
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
      const { scenario, trainScheduleSet } = await createScenario(
        generateUniqueName('timetable-item-scenario'),
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
  test('Select and delete all timetable items', async ({ scenarioTimetableSection }) => {
    await test.step('Verify initial totals', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
      });
    });

    await test.step('Select all timetable items', async () => {
      await scenarioTimetableSection.selectAllTimetableItemsAndVerifySelection(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
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
      await scenarioTimetableSection.verifyTimetableIsEmpty(frTranslations.timetable.noItem);
    });
  });
});
