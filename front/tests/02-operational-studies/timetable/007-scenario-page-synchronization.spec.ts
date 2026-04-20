import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  timetableItemProjectName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type {
  CommonTranslations,
  ManageTimetableItemTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';

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

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'This test is only stable on Chromium due to tab sync flakiness in Firefox'
);

test.describe('Scenario page synchronization', { tag: ['@op, @multi-tab-sync'] }, () => {
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
        generateUniqueName('scenario-page-synchronization'),
        project.id,
        study.id,
        infra.id
      );
      scenarioItems = scenario;

      const selectedTrains = [...trains.slice(0, 2), ...trains.slice(7, 9)];
      await sendTrains(trainScheduleSet.id, selectedTrains);
    }
  );

  test.afterAll('Close pages', async () => {
    await deleteScenario(study.id, scenarioItems.name);
  });

  /** *************** Test 1 **************** */
  test('Reflects updates across tabs', async ({
    page,
    secondPage,
    scenarioTimetableSection,
    pacedTrainSection,
    studyPage,
    secondScenarioTimetableSection,
    secondOperationalStudiesPage,
  }) => {
    const scenarioUrl = `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`;

    await test.step('Open first tab on scenario page and wait infra cache', async () => {
      await page.goto(scenarioUrl);
      await waitForInfraStateToBeCached(infra.id);
    });

    await test.step('Open second tab on same scenario page', async () => {
      await secondPage.goto(scenarioUrl);
    });

    await test.step('Delete a paced train in first tab and verify counts', async () => {
      await page.bringToFront();
      await pacedTrainSection.deletePacedTrain(1, frTranslations);
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalUniqueTrainCount: 2,
      });
    });

    await test.step('Verify deletion is reflected in second tab', async () => {
      await secondPage.bringToFront();
      await secondScenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalUniqueTrainCount: 2,
      });
    });

    await test.step('Edit a unique train in second tab and verify the update', async () => {
      await secondScenarioTimetableSection.editTimetableItem(1);
      await secondOperationalStudiesPage.setFormattedStartTime('2025-03-15T08:35:40');
      await secondOperationalStudiesPage.submitTimetableItemEdit();
      await secondScenarioTimetableSection.getTimetableItemArrivalTime('08:43', 1);
    });

    await test.step('Confirm edit is synchronized back in first tab', async () => {
      await page.bringToFront();
      await scenarioTimetableSection.getTimetableItemArrivalTime('08:43', 1);
    });

    await test.step('Go to study page in first tab, verify train count, delete scenario', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await studyPage.verifyScenarioTrainCount(scenarioItems.name, '3');
      await studyPage.deleteScenario(scenarioItems.name);
    });

    await test.step('Reload second tab and verify scenario is gone', async () => {
      await secondPage.bringToFront();
      await secondPage.reload();
      await secondOperationalStudiesPage.expectResourceNotFoundPage();
    });
  });
});
