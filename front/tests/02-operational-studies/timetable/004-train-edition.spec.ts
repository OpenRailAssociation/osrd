import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import { FREIGHT_TRAIN, HIGH_SPEED_TRAIN_COLOR } from '../../assets/operation-studies/train-const';
import {
  PACED_TRAIN_OCCURRENCE_COUNT,
  EDITED_PACED_TRAIN_NAME,
  INTERVAL,
  TIME_WINDOW,
  TIME_WINDOW_HOURS,
  TIME_WINDOW_MINUTES,
} from '../../assets/paced-train/const';
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

test.describe('Train edition', { tag: ['@op', '@paced-trains', '@unique-trains'] }, () => {
  setupScenarioFixture({
    scenarioNamePrefix: 'edit-train-scenario',
    trains: [...trains.slice(0, 1), ...trains.slice(7, 8)],
    scope: 'test',
  });

  /** *************** Test 1 **************** */
  test('Edit a paced train', async ({
    scenarioTimetableSection,
    pacedTrainSection,
    headerPage,
  }) => {
    await test.step('Open the paced train header', async () => {
      await pacedTrainSection.verifyOccurrencesCount(
        PACED_TRAIN_OCCURRENCE_COUNT,
        0,
        HIGH_SPEED_TRAIN_COLOR
      );
      await pacedTrainSection.selectPacedTrainModel(0);
      await headerPage.expandHeader();
    });

    await test.step('Update paced train properties', async () => {
      await headerPage.setServiceWindow(TIME_WINDOW_HOURS, TIME_WINDOW_MINUTES);
      await headerPage.setServiceCadenceMinutes(INTERVAL);
      await headerPage.setName(EDITED_PACED_TRAIN_NAME);
      await headerPage.selectCategory(FREIGHT_TRAIN.category);
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
        { occurrenceColor: FREIGHT_TRAIN.color }
      );
    });
  });

  /** *************** Test 2 **************** */
  test('Turn paced train into unique train', async ({
    scenarioTimetableSection,
    pacedTrainSection,
    headerPage,
  }) => {
    await test.step('Select the paced train and expand the header', async () => {
      await pacedTrainSection.selectPacedTrainModel(0);
      await headerPage.expandHeader();
    });

    await test.step('Convert paced train to unique train', async () => {
      await headerPage.toggleScheduleKind(false);
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
    headerPage,
  }) => {
    await test.step('Select the unique train at index 0 and expand the header', async () => {
      await scenarioTimetableSection.selectUniqueTrainModel(0);
      await headerPage.expandHeader();
    });

    await test.step('Convert unique train to paced train', async () => {
      await headerPage.toggleScheduleKind(true);
    });

    await test.step('Verify timetable labels after conversion', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: 2,
        totalUniqueTrainCount: 0,
      });
    });
  });
});
