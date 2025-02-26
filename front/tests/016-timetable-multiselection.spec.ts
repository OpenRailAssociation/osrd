import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import { trainScheduleProjectName, trainScheduleStudyName } from './assets/constants/project-const';
import {
  TOTAL_ITEMS,
  TOTAL_PACED_TRAINS,
  TOTAL_TRAINS,
} from './assets/constants/timetable-items-count';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { generateUniqueName, getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import sendTrainSchedules from './utils/train-schedule';
import type { CommonTranslations, TimetableFilterTranslations } from './utils/types';

const enScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/en/operationalStudies/scenario.json'
);
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/scenario.json'
);

const enCommonTranslations: CommonTranslations = readJsonFile('public/locales/en/translation.json');
const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const trainSchedulesJson: JSON = readJsonFile('./tests/assets/train-schedule/train_schedules.json');
const pacedTrainsJson: JSON = readJsonFile('./tests/assets/paced-train/paced_trains.json');

test.describe('Verify train schedule elements and filters', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;
  let operationalStudiesPage: OperationalStudiesPage;

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;
  let translations: TimetableFilterTranslations & CommonTranslations;

  test.beforeEach('Fetch project, study and scenario with train schedule', async ({ page }) => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
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

    translations = getTranslations({
      en: { ...enScenarioTranslations, ...enCommonTranslations },
      fr: { ...frScenarioTranslations, ...frCommonTranslations },
    });

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  test('Duplicate and delete a paced train', async ({ page }) => {
    scenarioTimetableSection = new ScenarioTimetableSection(page);
    operationalStudiesPage = new OperationalStudiesPage(page);

    await operationalStudiesPage.checkPacedTrainSwitch();

    // Verify total items count
    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS,
      totalTrainScheduleCount: TOTAL_TRAINS,
    });
    // Select all remaining items
    await scenarioTimetableSection.selectAllTimetableItems(translations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS,
      totalTrainScheduleCount: TOTAL_TRAINS,
    });
    // Delete all items
    await scenarioTimetableSection.deleteAllTimetableItems();
    // As in other tests, checking the last notification needs to be done in a different method
    // otherwise the received message of the last notification is empty
    await scenarioTimetableSection.verifyAllTimetableItemsHaveBeenDeleted(
      TOTAL_ITEMS,
      translations
    );
    // Verify timetable is empty and total label is empty
    await scenarioTimetableSection.verifyTimetableIsEmpty(translations.timetable.noTrain);
  });
});
