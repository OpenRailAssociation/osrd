import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleScenarioName,
  trainScheduleStudyName,
} from './assets/constants/project-const';
import {
  HONORED_ITEMS,
  HONORED_TRAINS,
  INVALID_AND_NOT_HONORED_TRAINS,
  INVALID_ITEMS,
  INVALID_TRAINS,
  ITEMS_WITH_NO_SPEED_LIMIT_TAG,
  LABEL_FILTERED_ITEMS,
  NAME_FILTERED_ITEMS,
  NOT_HONORED_ITEMS,
  NOT_HONORED_PACED_TRAINS,
  NOT_HONORED_TRAINS,
  ROLLING_STOCK_FILTERED_ITEMS,
  TOTAL_ITEMS,
  TOTAL_PACED_TRAINS,
  TOTAL_TRAINS,
  VALID_AND_HONORED_TRAINS,
  VALID_ITEMS,
  VALID_PACED_TRAINS,
  VALID_TRAINS,
} from './assets/constants/timetable-items-count';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { getTranslations, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getScenario, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import type { CommonTranslations, TimetableFilterTranslations } from './utils/types';

const enScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/en/operationalStudies/scenario.json'
);
const frScenarioTranslations: TimetableFilterTranslations = readJsonFile(
  'public/locales/fr/operationalStudies/scenario.json'
);

const enCommonTranslations: CommonTranslations = readJsonFile('public/locales/en/translation.json');
const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

test.describe('Verify train schedule elements and filters', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;
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
    operationalStudiesPage = new OperationalStudiesPage(page);
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );
    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Loading trains and verifying simulation result', async () => {
    // Verify train count, invalid train messages, and train simulation results
    await scenarioTimetableSection.verifyTrainCount(TOTAL_TRAINS);
    await scenarioTimetableSection.verifyInvalidTrainsMessageVisibility();
    await scenarioTimetableSection.checkSelectedTimetableTrain();
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Valid',
      VALID_TRAINS,
      translations
    );
    await scenarioTimetableSection.verifyEachTrainSimulation();
  });

  // TODO Paced train - remove this test in https://github.com/OpenRailAssociation/osrd/issues/10791
  /** *************** Test 2 **************** */
  test('Filtering imported trains', async () => {
    // Verify train count and apply different filters for validity and honored status
    await scenarioTimetableSection.verifyTrainCount(TOTAL_TRAINS);
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Invalid',
      INVALID_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'All',
      TOTAL_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
      'Honored',
      HONORED_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Valid',
      VALID_AND_HONORED_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
      'Not honored',
      NOT_HONORED_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Invalid',
      INVALID_AND_NOT_HONORED_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
      'All',
      INVALID_TRAINS,
      translations
    );
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'All',
      TOTAL_TRAINS,
      translations
    );

    // Verify train composition filters with predefined filter codes and expected counts
    const compositionFilters = [
      { code: 'MA100', count: 7 },
      { code: 'HLP', count: 3 },
      { code: 'E32C', count: 1 },
      { code: null, count: 10 }, // Null means no specific code applied
    ];

    for (const filter of compositionFilters) {
      await scenarioTimetableSection.filterSpeedLimitTagAndVerifyTrainCount(
        filter.code,
        filter.count,
        translations
      );
    }
    await scenarioTimetableSection.verifyTrainCount(TOTAL_TRAINS);
  });

  // TODO Paced train : update this test with real data in https://github.com/OpenRailAssociation/osrd/issues/10615
  /** *************** Test 3 **************** */
  test('Filtering imported trains and paced trains', async () => {
    await operationalStudiesPage.checkPacedTrainSwitch();

    // While the back end for paced trains isn't ready, 3 paced trains are hardcoded and
    // added to the list of train schedules for testing purposes.
    // These 3 paced trains are copy of the first train schedule in the list (1 valid, 1 not invalid, 1 not honored).
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
      'Paced Train 1',
      NAME_FILTERED_ITEMS
    );
    await scenarioTimetableSection.filterNameAndVerifyTrainCount(
      'Paced-Train-Tag-1',
      LABEL_FILTERED_ITEMS
    );

    // Rolling stock name and details filter
    await scenarioTimetableSection.filterRollingStockAndVerifyTrainCount(
      'slow_rolling_stock',
      ROLLING_STOCK_FILTERED_ITEMS
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
  });
});
