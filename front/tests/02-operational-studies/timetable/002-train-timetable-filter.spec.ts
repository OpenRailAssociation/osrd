import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  timetableItemProjectName,
  timetableItemScenarioName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import {
  HONORED_TIMETABLE_ITEMS,
  INVALID_TIMETABLE_ITEMS,
  ITEMS_WITH_HLP_SPEED_LIMIT_TAG_EXCEPTION,
  TIMETABLE_ITEMS_WITH_NO_SPEED_LIMIT_TAG,
  LABEL_FILTERED_TIMETABLE_ITEMS,
  LABEL_FILTERED_TIMETABLE_ITEMS_EXCEPTION,
  NAME_FILTERED_TIMETABLE_ITEMS,
  NAME_FILTERED_TIMETABLE_ITEMS_EXCEPTION,
  NAME_LABEL_FILTERED_TIMETABLE_ITEMS_MIXED,
  NOT_HONORED_TIMETABLE_ITEMS,
  NOT_HONORED_PACED_TRAIN_SCHEDULE,
  ROLLING_STOCK_FILTERED_TIMETABLE_ITEMS_EXCEPTION,
  TOTAL_TIMETABLE_ITEMS,
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
  VALID_TIMETABLE_ITEMS,
  VALID_PACED_TRAINS,
} from '../../assets/constants/timetable-items-count';
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

test.describe('@op @timetable-items @filter', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and scenario with unique train', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    scenario = await getScenario(study.id, timetableItemScenarioName);
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
  test('Filtering imported timetable items', async ({ scenarioTimetableSection }) => {
    await test.step('Verify totals and default filter UI', async () => {
      await scenarioTimetableSection.verifyTotalItemsLabel(frTranslations, {
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
        NAME_FILTERED_TIMETABLE_ITEMS
      );
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'Paced-Train-Tag-2',
        LABEL_FILTERED_TIMETABLE_ITEMS
      );
    });

    await test.step('Filter by name / label (exceptions & mixed)', async () => {
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'abc',
        NAME_FILTERED_TIMETABLE_ITEMS_EXCEPTION
      );
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'exception',
        NAME_LABEL_FILTERED_TIMETABLE_ITEMS_MIXED
      );
      await scenarioTimetableSection.filterNameAndVerifyTrainCount(
        'exception-label',
        LABEL_FILTERED_TIMETABLE_ITEMS_EXCEPTION
      );
    });

    await test.step('Filter by rolling stock', async () => {
      await scenarioTimetableSection.filterRollingStockAndVerifyTrainCount(
        'slow_rolling_stock',
        ROLLING_STOCK_FILTERED_TIMETABLE_ITEMS_EXCEPTION
      );
    });

    await test.step('Filter by validity', async () => {
      await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
        'Invalid',
        INVALID_TIMETABLE_ITEMS,
        frTranslations
      );
      await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
        'Valid',
        VALID_TIMETABLE_ITEMS,
        frTranslations
      );
    });

    await test.step('Filter by punctuality (Honored/Not honored)', async () => {
      await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
        'Honored',
        HONORED_TIMETABLE_ITEMS,
        frTranslations
      );
      await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
        'Not honored',
        NOT_HONORED_TIMETABLE_ITEMS,
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
        TOTAL_TIMETABLE_ITEMS
      );
    });

    await test.step('Filter by speed limit tag and verify counts', async () => {
      await scenarioTimetableSection.filterSpeedLimitTagAndVerifyTrainCount(
        null,
        TIMETABLE_ITEMS_WITH_NO_SPEED_LIMIT_TAG,
        frTranslations
      );
      await scenarioTimetableSection.verifyTimetableItemsCount(TOTAL_TIMETABLE_ITEMS);

      await scenarioTimetableSection.filterSpeedLimitTagAndVerifyTrainCount(
        'HLP',
        ITEMS_WITH_HLP_SPEED_LIMIT_TAG_EXCEPTION,
        frTranslations
      );
      await scenarioTimetableSection.verifyTimetableItemsCount(TOTAL_TIMETABLE_ITEMS);
    });
  });
});
