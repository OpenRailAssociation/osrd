import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleScenarioName,
  trainScheduleStudyName,
} from './assets/constants/project-const';
import test from './logging-fixture';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getScenario, getStudy } from './utils/api-setup';

test.describe('Verify train schedule elements and filters', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  // Constants for expected train counts
  const TOTAL_TRAINS = 21;
  const VALID_TRAINS = 17;
  const INVALID_TRAINS = 4;
  const HONORED_TRAINS = 14;
  const NOT_HONORED_TRAINS = 3;
  const VALID_AND_HONORED_TRAINS = 14;
  const INVALID_AND_NOT_HONORED_TRAINS = 0;

  test.beforeAll('Fetch project, study and scenario with train schedule', async () => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
    scenario = await getScenario(project.id, study.id, trainScheduleScenarioName);
    infra = await getInfra();
  });

  test.beforeEach('Navigate to scenario page before each test', async ({ page }) => {
    scenarioTimetableSection = new ScenarioTimetableSection(page);
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
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount('Valid', VALID_TRAINS);
    await scenarioTimetableSection.verifyEachTrainSimulation();
  });

  /** *************** Test 2 **************** */
  test('Filtering imported trains', async () => {
    // Verify train count and apply different filters for validity and honored status
    await scenarioTimetableSection.verifyTrainCount(TOTAL_TRAINS);
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount('Invalid', INVALID_TRAINS);
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount('All', TOTAL_TRAINS);
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount('Honored', HONORED_TRAINS);
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Valid',
      VALID_AND_HONORED_TRAINS
    );
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount(
      'Not honored',
      NOT_HONORED_TRAINS
    );
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
      'Invalid',
      INVALID_AND_NOT_HONORED_TRAINS
    );
    await scenarioTimetableSection.filterHonoredAndVerifyTrainCount('All', INVALID_TRAINS);
    await scenarioTimetableSection.filterValidityAndVerifyTrainCount('All', TOTAL_TRAINS);

    // Verify train composition filters with predefined filter codes and expected counts
    const compositionFilters = [
      { code: 'MA100', count: 7 },
      { code: 'HLP', count: 3 },
      { code: 'E32C', count: 1 },
      { code: null, count: 10 }, // Null means no specific code applied
    ];

    for (const filter of compositionFilters) {
      await scenarioTimetableSection.clickCodeCompoTrainFilterButton(filter.code, filter.count);
    }
  });
});
