import type { Page } from '@playwright/test';

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
import StudyPage from './pages/operational-studies/study-page';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
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

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'This test is only stable on Chromium due to tab sync flakiness in Firefox'
);

test.describe('Synchronize the scenario page across multiple windows', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  let firstPage: Page;
  let secondPage: Page;
  let firstTimetableSection: ScenarioTimetableSection;
  let secondTimetableSection: ScenarioTimetableSection;
  let pacedTrainSection: PacedTrainSection;
  let studyPage: StudyPage;
  let operationalStudiesPage: OperationalStudiesPage;

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
    }
  );

  test.afterAll('Close pages', async () => {
    await firstPage.close();
    await secondPage.close();
  });

  /** *************** Test 1 **************** */
  test('Reflects updates across tabs', async ({ context }) => {
    const scenarioUrl = `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`;

    await test.step('Open first tab on scenario page and wait infra cache', async () => {
      firstPage = await context.newPage();
      await firstPage.goto(scenarioUrl);
      firstTimetableSection = new ScenarioTimetableSection(firstPage);
      pacedTrainSection = new PacedTrainSection(firstPage);
      studyPage = new StudyPage(firstPage);
      await waitForInfraStateToBeCached(infra.id);
    });

    await test.step('Open second tab on same scenario page', async () => {
      secondPage = await context.newPage();
      await secondPage.goto(scenarioUrl);
      secondTimetableSection = new ScenarioTimetableSection(secondPage);
      operationalStudiesPage = new OperationalStudiesPage(secondPage);
    });

    await test.step('Delete a paced train in first tab and verify counts', async () => {
      await firstPage.bringToFront();
      await pacedTrainSection.deletePacedTrain(1, frTranslations);
      await firstTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalTrainScheduleCount: 2,
      });
    });

    await test.step('Verify deletion is reflected in second tab', async () => {
      await secondPage.bringToFront();
      await secondTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalTrainScheduleCount: 2,
      });
    });

    await test.step('Edit a train schedule in second tab and verify the update', async () => {
      await secondTimetableSection.editTimetableItem(1);
      await operationalStudiesPage.setFormattedStartTime('2025-03-15T08:35:40');
      await operationalStudiesPage.submitTimetableItemEdit();
      await secondTimetableSection.getTimetableItemArrivalTime('08:43', 1);
    });

    await test.step('Confirm edit is synchronized back in first tab', async () => {
      await firstPage.bringToFront();
      await firstTimetableSection.getTimetableItemArrivalTime('08:43', 1);
    });

    await test.step('Go to study page in first tab, verify train count, delete scenario', async () => {
      await firstPage.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await studyPage.verifyScenarioTrainCount(scenarioItems.name, '3');
      await studyPage.deleteScenario(scenarioItems.name);
    });

    await test.step('Reload second tab and verify scenario is gone', async () => {
      await secondPage.bringToFront();
      await secondPage.reload();
      await operationalStudiesPage.expectResourceNotFoundPage();
    });
  });
});
