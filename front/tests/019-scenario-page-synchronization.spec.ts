import type {
  Scenario,
  Project,
  Study,
  Infra,
  TrainSchedule,
  PacedTrain,
} from 'common/api/osrdEditoastApi';

import { trainScheduleProjectName, trainScheduleStudyName } from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import StudyPage from './pages/operational-studies/study-page';
import { generateUniqueName, getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import sendTrainSchedules from './utils/train-schedule';
import type {
  CommonTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from './utils/types';

const enManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/en/operational-studies.json').manageTrainSchedule;
const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const enScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/en/operational-studies.json').main;
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const enCommonTranslations: CommonTranslations = readJsonFile('public/locales/en/translation.json');
const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const trainSchedulesJson = readJsonFile<TrainSchedule[]>(
  './tests/assets/train-schedule/train_schedules.json'
);
const pacedTrainsJson = readJsonFile<PacedTrain[]>('./tests/assets/paced-train/paced_trains.json');
test.describe('Synchronize the scenario page across multiple windows', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let translations: ManageTrainScheduleTranslations &
    TimetableFilterTranslations &
    CommonTranslations;
  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeEach('Fetch project, study and scenario with train schedule', async () => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
    infra = await getInfra();
    scenarioItems = (
      await createScenario(
        generateUniqueName('scenario-page-synchronization'),
        project.id,
        study.id,
        infra.id
      )
    ).scenario;
    await sendTrainSchedules(
      scenarioItems.timetable_id,
      JSON.parse(JSON.stringify(trainSchedulesJson.slice(0, 2)))
    );
    await sendPacedTrains(
      scenarioItems.timetable_id,
      JSON.parse(JSON.stringify(pacedTrainsJson.slice(0, 2)))
    );
    translations = getTranslations({
      en: {
        ...enManageTrainScheduleTranslations,
        ...enScenarioTranslations,
        ...enCommonTranslations,
      },
      fr: {
        ...frManageTrainScheduleTranslations,
        ...frScenarioTranslations,
        ...frCommonTranslations,
      },
    });
  });

  test('Reflects updates across tabs ', async ({ context }) => {
    const scenarioUrl = `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`;

    // Open the first tab and navigate to the scenario page
    const firstPage = await context.newPage();
    await firstPage.goto(scenarioUrl);
    const firstTimetableSection = new ScenarioTimetableSection(firstPage);
    const pacedTrainSection = new PacedTrainSection(firstPage);
    const studyPage = new StudyPage(firstPage);

    await waitForInfraStateToBeCached(infra.id);

    // Open the second tab and navigate to the same scenario page
    const secondPage = await context.newPage();
    await secondPage.goto(scenarioUrl);
    const secondTimetableSection = new ScenarioTimetableSection(secondPage);
    const operationalStudiesPage = new OperationalStudiesPage(secondPage);

    // Delete a paced train in the first tab and verify the update
    await firstPage.bringToFront();
    await pacedTrainSection.deletePacedTrain(1, translations);
    await firstPage.waitForLoadState('networkidle');
    await firstTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: 1,
      totalTrainScheduleCount: 2,
    });

    // Switch to the second tab and verify that the deletion is reflected
    await secondPage.bringToFront();
    await secondTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: 1,
      totalTrainScheduleCount: 2,
    });

    // Edit a train schedule in the second tab and verify the update
    await secondTimetableSection.editTrain(1);
    await operationalStudiesPage.setFormattedStartTime('2025-03-15T08:35:40');
    await secondTimetableSection.editTrainSchedule();
    await secondTimetableSection.getTrainArrivalTime('08:43', 1);

    // Switch back to the first tab and confirm that the edit is synchronized
    await firstPage.bringToFront();
    await firstTimetableSection.getTrainArrivalTime('08:43', 1);

    // Navigate back to the study page, verify the train count, then delete the scenario
    await firstPage.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
    await studyPage.verifyScenarioTrainCount(scenarioItems.name, '3');
    await studyPage.deleteScenario(scenarioItems.name);

    // Switch to the second tab and verify the scenario is no longer available
    await secondPage.bringToFront();
    await secondPage.reload();
    await operationalStudiesPage.expectResourceNotFoundPage();
  });
});
