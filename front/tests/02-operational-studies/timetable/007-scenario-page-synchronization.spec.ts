import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { readJsonFile } from '../../utils/file-utils';
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

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'This test is only stable on Chromium due to tab sync flakiness in Firefox'
);

test.describe('Scenario page synchronization', { tag: ['@op, @multi-tab-sync'] }, () => {
  const scenarioContext = setupScenarioFixture({
    scenarioNamePrefix: 'scenario-page-synchronization',
    trains: [...trains.slice(0, 2), ...trains.slice(7, 9)],
  });

  /** *************** Test 1 **************** */
  test('Reflects updates across tabs', async ({
    page,
    secondPage,
    scenarioTimetableSection,
    pacedTrainSection,
    studyPage,
    secondScenarioTimetableSection,
    secondTimesStopsTablePage,
  }) => {
    const { project, study, scenarioItems } = scenarioContext;
    const scenarioUrl = `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`;

    await test.step('Open second tab on same scenario page', async () => {
      await secondPage.goto(scenarioUrl);
    });

    await test.step('Delete a paced train in first tab and verify counts', async () => {
      await page.bringToFront();
      await pacedTrainSection.deletePacedTrain(1, frTranslations);
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalUniqueTrainCount: 2,
      });
    });

    await test.step('Verify deletion is reflected in second tab', async () => {
      await secondPage.bringToFront();
      await secondScenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: 1,
        totalUniqueTrainCount: 2,
      });
    });

    await test.step('Edit a unique train in second tab and verify the update', async () => {
      await secondScenarioTimetableSection.selectUniqueTrainModel(1);
      await secondTimesStopsTablePage.verifyTimesStopsDataSheetVisibility();
      const originRow = secondTimesStopsTablePage.getRow(0);
      await secondTimesStopsTablePage.editRequestedArrival(originRow, '08:35:40');
      await secondScenarioTimetableSection.getTrainScheduleArrivalTime('08:53', 1);
    });

    await test.step('Confirm edit is synchronized back in first tab', async () => {
      await page.bringToFront();
      await scenarioTimetableSection.getTrainScheduleArrivalTime('08:53', 1);
    });

    await test.step('Go to study page in first tab, verify train count, delete scenario', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await studyPage.verifyScenarioTrainCount(scenarioItems.name, '3');
      await studyPage.deleteScenario(scenarioItems.name);
    });

    await test.step('Reload second tab and verify scenario is gone', async () => {
      await secondPage.bringToFront();
      await secondPage.reload();
      await secondScenarioTimetableSection.expectResourceNotFoundPage();
    });
  });
});
