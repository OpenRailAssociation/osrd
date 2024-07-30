import { test } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import type { Infra, Project, Scenario, Study, TimetableResult } from 'common/api/osrdEditoastApi';

import scenarioData from './assets/operationStudies/scenario.json';
import HomePage from './pages/home-page-model';
import OperationalStudiesTimetablePage from './pages/op-timetable-page-model';
import ScenarioPage from './pages/scenario-page-model';
import { readJsonFile } from './utils';
import { getInfra, getProject, getStudy, postApiRequest } from './utils/api-setup';
import { postSimulation, sendTrainSchedule } from './utils/trainSchedule-utils';

let selectedLanguage: string;
let smallInfra: Infra;
let project: Project;
let study: Study;
let scenario: Scenario;
let timetableResult: TimetableResult;

const trainSchedulesJson = readJsonFile('./tests/assets/trainSchedule/train_schedules.json');
test.beforeAll(async () => {
  // Fetch infrastructure, project, study, and timetable result
  smallInfra = (await getInfra()) as Infra;
  project = await getProject();
  study = await getStudy(project.id);
  timetableResult = await postApiRequest(`/api/v2/timetable/`);

  // Create a new scenario with a unique name
  scenario = await postApiRequest(`/api/v2/projects/${project.id}/studies/${study.id}/scenarios/`, {
    ...scenarioData,
    name: `${scenarioData.name} ${uuidv4()}`,
    study_id: study.id,
    infra_id: smallInfra.id,
    timetable_id: timetableResult.timetable_id,
  });

  // Post train schedule import and simulation
  const response = await sendTrainSchedule(scenario.timetable_id, trainSchedulesJson);
  await postSimulation(response, smallInfra.id);
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
    await opTimetablePage.verifyTrainCount(20, selectedLanguage);
    await opTimetablePage.verifyInvalidTrainsMessageVisibility(selectedLanguage);
    await opTimetablePage.checkSelectedTimetableTrain();
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Valid', 16);
    await opTimetablePage.verifyEachTrainSimulation();
  });

  test('should accurately filter the imported trains', async ({ page }) => {
    test.setTimeout(120000);
    const scenarioPage = new ScenarioPage(page);
    const opTimetablePage = new OperationalStudiesTimetablePage(page);

    // Check if the infrastructure is loaded
    await scenarioPage.checkInfraLoaded();

    // Verify the train count and apply various filters
    await opTimetablePage.verifyTrainCount(20, selectedLanguage);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Invalid', 4);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'All', 20);
    await opTimetablePage.filterHonoredAndVerifyTrainCount(selectedLanguage, 'Honored', 12);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Valid', 12);
    await opTimetablePage.filterHonoredAndVerifyTrainCount(selectedLanguage, 'Not honored', 4);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'Invalid', 0);
    await opTimetablePage.filterHonoredAndVerifyTrainCount(selectedLanguage, 'All', 4);
    await opTimetablePage.filterValidityAndVerifyTrainCount(selectedLanguage, 'All', 20);

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
        filter.count
      );
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */
  });
});
