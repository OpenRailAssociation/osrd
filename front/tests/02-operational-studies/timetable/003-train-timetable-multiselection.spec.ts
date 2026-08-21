import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  TOTAL_TRAIN_SCHEDULES,
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
} from '../../assets/constants/train-schedules-count';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { readJsonFile } from '../../utils/file-utils';
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
  setupScenarioFixture({
    scenarioNamePrefix: 'train-schedule-scenario',
    trains,
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
