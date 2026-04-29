import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleScenarioName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import {
  HONORED_TRAIN_SCHEDULES,
  INVALID_TRAIN_SCHEDULES,
  TRAIN_SCHEDULES_WITH_HLP_SPEED_LIMIT_TAG_EXCEPTION,
  TRAIN_SCHEDULES_WITH_NO_SPEED_LIMIT_TAG,
  LABEL_FILTERED_TRAIN_SCHEDULES,
  LABEL_FILTERED_TRAIN_SCHEDULES_EXCEPTION,
  NAME_FILTERED_TRAIN_SCHEDULES,
  NAME_FILTERED_TRAIN_SCHEDULES_EXCEPTION,
  NAME_LABEL_FILTERED_TRAIN_SCHEDULES_MIXED,
  NOT_HONORED_TRAIN_SCHEDULES,
  NOT_HONORED_PACED_TRAIN_SCHEDULE,
  ROLLING_STOCK_FILTERED_TRAIN_SCHEDULES_EXCEPTION,
  TOTAL_TRAIN_SCHEDULES,
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
  VALID_TRAIN_SCHEDULES,
  VALID_PACED_TRAINS,
} from '../../assets/constants/train-schedules-count';
import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getScenario, getStudy } from '../../utils/api-utils';
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

// TODO: Properly count trains even if the virtualised train list does not render them yet;
//       this workaround simply makes the viewport bigger so the whole list is rendered.
test.use({ viewport: { width: 1920, height: 1920 } });

test.describe('Train schedules filtering', { tag: ['@op', '@train-schedules', '@filter'] }, () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and scenario with unique train', async () => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
    scenario = await getScenario(study.id, trainScheduleScenarioName);
    infra = await getInfra();
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page }) => {
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    }
  );

  /** *************** Test 1 **************** */
  test('Filtering imported train schedules', async ({ scenarioTimetableSection }) => {
    await test.step('Verify totals and default filter UI', async () => {
      await scenarioTimetableSection.verifyTotalTrainSchedulesLabel(frTranslations, {
        totalPacedTrainCount: TOTAL_PACED_TRAINS,
        totalUniqueTrainCount: TOTAL_UNIQUE_TRAINS,
      });
      await scenarioTimetableSection.checkTimetableFilterVisibilityLabelDefaultValue(
        frTranslations.timetable,
        { inputDefaultValue: '', selectDefaultValue: 'both' }
      );
    });

    await test.step('Filter by name / label (standard)', async () => {
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'Paced Train - Updated exception (Train name)',
        NAME_FILTERED_TRAIN_SCHEDULES
      );
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'Paced-Train-Tag-2',
        LABEL_FILTERED_TRAIN_SCHEDULES
      );
    });

    await test.step('Filter by name / label (exceptions & mixed)', async () => {
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'abc',
        NAME_FILTERED_TRAIN_SCHEDULES_EXCEPTION
      );
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'exception',
        NAME_LABEL_FILTERED_TRAIN_SCHEDULES_MIXED
      );
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'exception-label',
        LABEL_FILTERED_TRAIN_SCHEDULES_EXCEPTION
      );
    });

    await test.step('Filter by rolling stock', async () => {
      await scenarioTimetableSection.filterRollingStockAndVerifyTrainCount(
        'slow_rolling_stock',
        ROLLING_STOCK_FILTERED_TRAIN_SCHEDULES_EXCEPTION
      );
    });

    await test.step('Filter by validity', async () => {
      await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
        'Invalid',
        INVALID_TRAIN_SCHEDULES,
        frTranslations
      );
      await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
        'Valid',
        VALID_TRAIN_SCHEDULES,
        frTranslations
      );
    });

    await test.step('Filter by punctuality (Honored/Not honored)', async () => {
      await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
        'Honored',
        HONORED_TRAIN_SCHEDULES,
        frTranslations
      );
      await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
        'Not honored',
        NOT_HONORED_TRAIN_SCHEDULES,
        frTranslations
      );
    });

    await test.step('Filter by train type', async () => {
      await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount(
        'Service',
        NOT_HONORED_PACED_TRAIN_SCHEDULE
      );
      await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
        'All',
        VALID_PACED_TRAINS,
        frTranslations
      );
      await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
        'All',
        TOTAL_PACED_TRAINS,
        frTranslations
      );
      await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount(
        'Unique train',
        TOTAL_UNIQUE_TRAINS
      );
      await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount(
        'All',
        TOTAL_TRAIN_SCHEDULES
      );
    });

    await test.step('Filter by speed limit tag and verify counts', async () => {
      await scenarioTimetableSection.filterSpeedLimitTagAndVerifyTrainCount(
        null,
        TRAIN_SCHEDULES_WITH_NO_SPEED_LIMIT_TAG,
        frTranslations
      );
      await scenarioTimetableSection.verifyTrainSchedulesCount(TOTAL_TRAIN_SCHEDULES);

      await scenarioTimetableSection.filterSpeedLimitTagAndVerifyTrainCount(
        'HLP',
        TRAIN_SCHEDULES_WITH_HLP_SPEED_LIMIT_TAG_EXCEPTION,
        frTranslations
      );
      await scenarioTimetableSection.verifyTrainSchedulesCount(TOTAL_TRAIN_SCHEDULES);
    });
  });
});
