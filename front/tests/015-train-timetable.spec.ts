import test from '@playwright/test';

import type { Scenario, Project, Study, Infra, PacedTrain } from 'common/api/osrdEditoastApi';

import {
  IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS,
  IMPORTED_PACED_TRAIN_DETAILS,
} from './assets/constants/operational-studies-const';
import {
  trainScheduleProjectName,
  trainScheduleScenarioName,
  trainScheduleStudyName,
} from './assets/constants/project-const';
import {
  HONORED_ITEMS,
  INVALID_ITEMS,
  ITEMS_WITH_HLP_SPEED_LIMIT_TAG_EXCEPTION,
  ITEMS_WITH_NO_SPEED_LIMIT_TAG,
  LABEL_FILTERED_ITEMS,
  LABEL_FILTERED_ITEMS_EXCEPTION,
  NAME_FILTERED_ITEMS,
  NAME_FILTERED_ITEMS_EXCEPTION,
  NOT_HONORED_ITEMS,
  NOT_HONORED_PACED_TRAINS,
  ROLLING_STOCK_FILTERED_ITEMS_EXCEPTION,
  TOTAL_ITEMS,
  TOTAL_PACED_TRAINS,
  TOTAL_TRAINS,
  VALID_ITEMS,
  VALID_PACED_TRAINS,
  VALID_TRAINS,
} from './assets/constants/timetable-items-count';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getScenario, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import type { CommonTranslations, TimetableFilterTranslations } from './utils/types';

const enScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/en/operational-studies.json').main;
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const enCommonTranslations: CommonTranslations = readJsonFile('public/locales/en/translation.json');
const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

test.describe('Verify train schedule elements and filters', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;
  let pacedTrainSection: PacedTrainSection;
  let operationalStudiesPage: OperationalStudiesPage;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;
  let translations: TimetableFilterTranslations & CommonTranslations;

  test.beforeAll('Fetch project, study and scenario with train schedule', async () => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
    scenario = await getScenario(project.id, study.id, trainScheduleScenarioName);
    infra = await getInfra();
    translations = getTranslations({
      en: { ...enScenarioTranslations, ...enCommonTranslations },
      fr: { ...frScenarioTranslations, ...frCommonTranslations },
    });
  });

  test.beforeEach('Navigate to scenario page before each test', async ({ page }) => {
    scenarioTimetableSection = new ScenarioTimetableSection(page);
    pacedTrainSection = new PacedTrainSection(page);
    operationalStudiesPage = new OperationalStudiesPage(page);
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );
    await operationalStudiesPage.removeViteOverlay();
    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);

    await page.waitForLoadState('networkidle');
  });

  /** *************** Test 1 **************** */
  test('Loading trains and verifying simulation result for trainSchedule', async () => {
    // Verify train count, invalid train messages, and train simulation results
    await scenarioTimetableSection.verifyTrainCount(TOTAL_ITEMS);
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Valid',
      VALID_ITEMS,
      translations
    );
    await scenarioTimetableSection.verifyEachTrainSimulation(VALID_TRAINS);
  });

  /** *************** Test 2 **************** */
  test('Loading trains and verifying simulation result for paced trains', async () => {
    // Verify train count, invalid train messages, and train simulation results
    await scenarioTimetableSection.verifyTrainCount(TOTAL_ITEMS);
    await scenarioTimetableSection.verifyInvalidTrainsMessageVisibility();
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Valid',
      VALID_ITEMS,
      translations
    );
    await scenarioTimetableSection.verifyPacedTrainSimulations(VALID_PACED_TRAINS);
  });

  /** *************** Test 3 **************** */
  test('Filtering imported trains and paced trains', async () => {
    await scenarioTimetableSection.verifyTotalItemsLabel(translations, {
      totalPacedTrainCount: TOTAL_PACED_TRAINS,
      totalTrainScheduleCount: TOTAL_TRAINS,
    });

    await scenarioTimetableSection.checkTimetableFilterVisibilityLabelDefaultValue(
      translations.timetable,
      { inputDefaultValue: '', selectDefaultValue: 'both' }
    );

    // Name and label filter
    await scenarioTimetableSection.filterNameAndVerifyTrainCount(
      'Paced Train 2',
      NAME_FILTERED_ITEMS
    );
    await scenarioTimetableSection.filterNameAndVerifyTrainCount(
      'Paced-Train-Tag-2',
      LABEL_FILTERED_ITEMS
    );

    // Name and label filter for exceptions
    await scenarioTimetableSection.filterNameAndVerifyTrainCount(
      'abc',
      NAME_FILTERED_ITEMS_EXCEPTION
    );
    await scenarioTimetableSection.filterNameAndVerifyTrainCount(
      'exception',
      LABEL_FILTERED_ITEMS_EXCEPTION
    );

    // Rolling stock name and details filter
    await scenarioTimetableSection.filterRollingStockAndVerifyTrainCount(
      'slow_rolling_stock',
      ROLLING_STOCK_FILTERED_ITEMS_EXCEPTION
    );

    // Validity filter
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Invalid',
      INVALID_ITEMS,
      translations
    );
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Valid',
      VALID_ITEMS,
      translations
    );

    // Punctuality filter
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
      'Honored',
      HONORED_ITEMS,
      translations
    );
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
      'Not honored',
      NOT_HONORED_ITEMS,
      translations
    );

    // Train type filter
    await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount(
      'Service',
      NOT_HONORED_PACED_TRAINS
    );
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
      'All',
      VALID_PACED_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'All',
      TOTAL_PACED_TRAINS,
      translations
    );

    await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount('Unique train', TOTAL_TRAINS);
    await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount('All', TOTAL_ITEMS);

    // Verify train composition filters with predefined filter codes and expected counts
    // TODO Paced train : add a paced train with a unique compo code in https://github.com/OpenRailAssociation/osrd/issues/10615
    await scenarioTimetableSection.filterSpeedLimitTagAndVerifyTrainCount(
      null,
      ITEMS_WITH_NO_SPEED_LIMIT_TAG,
      translations
    );
    await scenarioTimetableSection.verifyTrainCount(TOTAL_ITEMS);

    // Verify train composition filters with predefined filter codes and expected counts for exceptions
    await scenarioTimetableSection.filterSpeedLimitTagAndVerifyTrainCount(
      'HLP',
      ITEMS_WITH_HLP_SPEED_LIMIT_TAG_EXCEPTION,
      translations
    );
    await scenarioTimetableSection.verifyTrainCount(TOTAL_ITEMS);
  });

  /** *************** Test 4 **************** */
  test('Loading timetable items and verifying paced trains display', async () => {
    // Paced train data used in global setup
    const pacedTrainsData: PacedTrain[] = readJsonFile(
      './tests/assets/paced-train/paced_trains.json'
    );

    // Verify paced train item
    for (let paceTrainIndex = 0; paceTrainIndex < pacedTrainsData.length; paceTrainIndex += 1) {
      await pacedTrainSection.verifyPacedTrainItemDetails(
        IMPORTED_PACED_TRAIN_DETAILS[paceTrainIndex],
        paceTrainIndex,
        { occurrenceData: IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS[paceTrainIndex] }
      );
    }
  });
});
