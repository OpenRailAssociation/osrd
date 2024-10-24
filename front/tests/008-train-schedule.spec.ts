import type { Scenario, Project, Study } from 'common/api/osrdEditoastApi';

import HomePage from './pages/home-page-model';
import OperationalStudiesTimetablePage from './pages/op-timetable-page-model';
import OperationalStudiesPage from './pages/operational-studies-page-model';
import test from './test-logger';
import { readJsonFile } from './utils';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import { postSimulation, sendTrainSchedules } from './utils/trainSchedule';

test.describe('Verify train schedule elements and filters', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let OSRDLanguage: string;
  const trainSchedulesJson = readJsonFile('./tests/assets/trainSchedule/train_schedules.json');

  test.beforeAll('Set up the scenario and post train schedules before all tests', async () => {
    ({ project, study, scenario } = await createScenario());

    // Post train schedule and initiate simulation
    const response = await sendTrainSchedules(scenario.timetable_id, trainSchedulesJson);
    await postSimulation(response, scenario.infra_id);
  });
  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach('Navigate to scenario page before each test', async ({ page }) => {
    const operationalStudiesPage = new OperationalStudiesPage(page);
    const homePage = new HomePage(page);
    await homePage.goToHomePage();
    OSRDLanguage = await homePage.getOSRDLanguage();
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );
    // Ensure infrastructure is loaded
    await operationalStudiesPage.checkInfraLoaded();
  });

  /** *************** Test 1 **************** */
  test('Loading trains and verifying simulation result', async ({ page }) => {
    test.slow();

    const opTimetablePage = new OperationalStudiesTimetablePage(page);

    // Verify train count, invalid train messages, and train simulation results
    await opTimetablePage.verifyTrainCount(21);
    await opTimetablePage.verifyInvalidTrainsMessageVisibility(OSRDLanguage);
    await opTimetablePage.checkSelectedTimetableTrain();
    await opTimetablePage.filterValidityAndVerifyTrainCount(OSRDLanguage, 'Valid', 17);
    await opTimetablePage.verifyEachTrainSimulation();
  });

  /** *************** Test 2 **************** */
  test('Filtering imported trains', async ({ page }) => {
    test.slow();
    const opTimetablePage = new OperationalStudiesTimetablePage(page);

    // Verify train count and apply different filters for validity and honored status
    await opTimetablePage.verifyTrainCount(21); // Verify total number of trains: 21
    await opTimetablePage.filterValidityAndVerifyTrainCount(OSRDLanguage, 'Invalid', 4); // Verify 4 invalid trains
    await opTimetablePage.filterValidityAndVerifyTrainCount(OSRDLanguage, 'All', 21); // Verify all 21 trains
    await opTimetablePage.filterHonoredAndVerifyTrainCount(OSRDLanguage, 'Honored', 13); // Verify 13 honored trains
    await opTimetablePage.filterValidityAndVerifyTrainCount(OSRDLanguage, 'Valid', 13); // Verify 13 valid (honored) trains
    await opTimetablePage.filterHonoredAndVerifyTrainCount(OSRDLanguage, 'Not honored', 4); // Verify 4 valid but not honored trains
    await opTimetablePage.filterValidityAndVerifyTrainCount(OSRDLanguage, 'Invalid', 0); /// Verify 0 invalid and honored trains
    await opTimetablePage.filterHonoredAndVerifyTrainCount(OSRDLanguage, 'All', 4); // Verify 4 invalid trains in the honored filter
    await opTimetablePage.filterValidityAndVerifyTrainCount(OSRDLanguage, 'All', 21); // Verify all 21 trains

    // Verify train composition filters with predefined filter codes and expected counts
    const compositionFilters = [
      { code: 'MA100', count: 7 },
      { code: 'HLP', count: 3 },
      { code: 'E32C', count: 1 },
      { code: null, count: 10 }, // Null means no specific code applied
    ];

    for (const filter of compositionFilters) {
      await opTimetablePage.clickCodeCompoTrainFilterButton(
        OSRDLanguage,
        filter.code,
        filter.count
      );
    }
  });
});
