import { test } from '@playwright/test';

import type { ScenarioV2, Study, Project } from 'common/api/osrdEditoastApi';

import HomePage from './pages/home-page-model';
import OperationalStudiesTimetablePage from './pages/op-timetable-page-model';
import ScenarioPage from './pages/scenario-page-model';
import { readJsonFile } from './utils';
import setupScenario from './utils/scenario';
import { postSimulation, sendTrainSchedules } from './utils/trainSchedule';

let selectedLanguage: string;
let project: Project;
let study: Study;
let scenario: ScenarioV2;

const trainSchedulesJson = readJsonFile('./tests/assets/trainSchedule/train_schedules.json');

test.beforeAll(async () => {
  ({ project, study, scenario } = await setupScenario());

  // Post train schedule import and simulation
  const response = await sendTrainSchedules(scenario.timetable_id, trainSchedulesJson);
  await postSimulation(response, scenario.infra_id);
});

test.beforeEach(async ({ page }) => {
  const homePage = new HomePage(page);
  await homePage.goToHomePage();
  selectedLanguage = await homePage.getOSRDLanguage();

  // Navigate to the created scenario page
  await page.goto(
    `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
  );
});

test.describe('Verifying that all elements in the train schedule are loaded correctly', () => {
  test('should accurately load the trains with their corresponding simulation results', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const scenarioPage = new ScenarioPage(page);
    const opTimetablePage = new OperationalStudiesTimetablePage(page);

    // Check if the infrastructure is loaded
    await scenarioPage.checkInfraLoaded();

    // Verify the train count and various elements on the timetable page
    await opTimetablePage.verifyTrainCount(20, 20);
    await opTimetablePage.verifyInvalidTrainsMessageVisibility(selectedLanguage);
    await opTimetablePage.checkSelectedTimetableTrain();
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Valid', 16, 20);
    await opTimetablePage.verifyEachTrainSimulation();
  });

  test('should accurately filter the imported trains', async ({ page }) => {
    test.setTimeout(120000);
    const scenarioPage = new ScenarioPage(page);
    const opTimetablePage = new OperationalStudiesTimetablePage(page);

    // Check if the infrastructure is loaded
    await scenarioPage.checkInfraLoaded();

    // Verify the train count and apply various filters
    await opTimetablePage.verifyTrainCount(20, 20);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Invalid', 4, 20);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'All', 20, 20);
    await opTimetablePage.filterHonoredAndVerifyTrainCount(selectedLanguage, 'Honored', 12, 20);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Valid', 12, 20);
    await opTimetablePage.filterHonoredAndVerifyTrainCount(selectedLanguage, 'Not honored', 4, 20);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Invalid', 0, 20);
    await opTimetablePage.filterHonoredAndVerifyTrainCount(selectedLanguage, 'All', 4, 20);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'All', 20, 20);

    // Define the composition filters and verify each filter
    const compositionFilters = [
      { code: 'MA100', count: 7 },
      { code: 'HLP', count: 3 },
      { code: 'E32C', count: 1 },
      { code: 'Without code', count: 9 },
    ];

    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const filter of compositionFilters) {
      await opTimetablePage.clickCodeCompoTrainFilterButton(
        selectedLanguage,
        filter.code,
        filter.count,
        20
      );
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */
  });
});
