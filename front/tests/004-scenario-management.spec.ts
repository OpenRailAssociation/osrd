import { test, expect } from './baseFixtures';
import { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';
import { v4 as uuidv4 } from 'uuid';
import { PlaywrightHomePage } from './pages/home-page-model';
import project from './assets/operationStudies/project.json';
import study from './assets/operationStudies/study.json';
import scenario from './assets/operationStudies/scenario.json';

import { ProjectPage } from './pages/project-page-model';
import { StudyPage } from './pages/study-page-model';
import ScenarioPage from './pages/scenario-page-model';
import VARIABLES from './assets/operationStudies/testVariables';
import PlaywrightCommonPage from './pages/common-page-model';
import { postApiRequest, deleteApiRequest } from './assets/utils';

let newProjectData: Project;
let testInfra: Infra;

test.beforeEach(async () => {
  testInfra = await postApiRequest('/infra/', {
    name: VARIABLES.infraName,
  });
  expect(testInfra.name).toEqual(VARIABLES.infraName);

  newProjectData = await postApiRequest('/projects/', {
    ...project,
    name: `${project.name} ${uuidv4()}`,
    budget: 1234567890,
  });
});

test.afterEach(async () => {
  await deleteApiRequest(`/projects/${newProjectData.id}/`);

  const deleteTestInfra = await deleteApiRequest(`/infra/${testInfra.id}/`);
  expect(deleteTestInfra.status()).toEqual(204);
});

test.describe('Test if operationnal study : scenario creation workflow is working properly', () => {
  test('Create a new scenario', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const studyPage = new StudyPage(page);
    const scenarioPage = new ScenarioPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    const newStudyData: Study = await postApiRequest(`/projects/${newProjectData.id}/studies`, {
      ...study,
      name: `${study.name} ${uuidv4()}`,
      budget: 1234567890,
      project_id: newProjectData.id,
    });

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(newProjectData.name);
    await studyPage.openStudyByTestId(newStudyData.name);

    expect(scenarioPage.getAddScenarioBtn).toBeVisible();
    await scenarioPage.openScenarioCreationModal();

    const scenarioName = `${scenario.name} ${uuidv4()}`;
    await scenarioPage.setScenarioName(scenarioName);

    await scenarioPage.setScenarioDescription(scenario.description);

    // Infra created by CI has no electrical profile
    if (!process.env.CI) {
      await scenarioPage.setScenarioElectricProfileByName(VARIABLES.infraName);
    }

    await commonPage.setTag(scenario.tags[0]);
    await commonPage.setTag(scenario.tags[1]);
    await commonPage.setTag(scenario.tags[2]);

    await scenarioPage.setScenarioInfraByName(VARIABLES.infraName);
    const createButton = playwrightHomePage.page.getByTestId('createScenario');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/scenarios/*');
    expect(await scenarioPage.getScenarioName.textContent()).toContain(scenarioName);
    expect(await scenarioPage.getScenarioDescription.textContent()).toContain(scenario.description);
    expect(await scenarioPage.getScenarioInfraName.textContent()).toContain(VARIABLES.infraName);
  });

  test('Update a scenario', async ({ page }) => {
    const newStudyData: Study = await postApiRequest(`/projects/${newProjectData.id}/studies`, {
      ...study,
      name: `${study.name} ${uuidv4()}`,
      budget: 1234567890,
      project_id: newProjectData.id,
    });

    const newScenarioData: Scenario = await postApiRequest(
      `/projects/${newProjectData.id}/studies/${newStudyData.id}/scenarios`,
      {
        ...scenario,
        name: `${scenario.name} ${uuidv4()}`,
        study_id: newStudyData.id,
        infra_id: testInfra.id,
      }
    );

    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const studyPage = new StudyPage(page);
    const scenarioPage = new ScenarioPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(newProjectData.name);
    await studyPage.openStudyByTestId(newStudyData.name);
    await scenarioPage.openScenarioByTestId(newScenarioData.name!);
    await scenarioPage.openScenarioModalUpdate();

    const scenarioName = `${scenario.name} ${uuidv4()}`;
    await scenarioPage.setScenarioName(scenarioName);

    await scenarioPage.setScenarioDescription(`${newScenarioData.description!} (updated)`);

    await commonPage.setTag('update-tag');

    await scenarioPage.clickScenarioUpdateConfirmBtn();

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(newProjectData.name);
    await studyPage.openStudyByTestId(newStudyData.name);

    expect(await scenarioPage.getScenarioTags.textContent()).toContain(
      `${scenario.tags.join('')}update-tag`
    );

    await scenarioPage.openScenarioByTestId(scenarioName);

    expect(await scenarioPage.getScenarioName.textContent()).toContain(scenarioName);
    expect(await scenarioPage.getScenarioDescription.textContent()).toContain(
      `${newScenarioData.description!} (updated)`
    );
  });

  test('Delete a scenario', async ({ page }) => {
    const newStudyData: Study = await postApiRequest(`/projects/${newProjectData.id}/studies`, {
      ...study,
      name: `${study.name} ${uuidv4()}`,
      budget: 1234567890,
      project_id: newProjectData.id,
    });

    const newScenarioData: Scenario = await postApiRequest(
      `/projects/${newProjectData.id}/studies/${newStudyData.id}/scenarios`,
      {
        ...scenario,
        name: `${scenario.name} ${uuidv4()}`,
        study_id: newStudyData.id,
        infra_id: testInfra.id,
      }
    );

    const playwrightHomePage = new PlaywrightHomePage(page);
    const projectPage = new ProjectPage(page);
    const studyPage = new StudyPage(page);
    const scenarioPage = new ScenarioPage(page);

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(newProjectData.name);
    await studyPage.openStudyByTestId(newStudyData.name);
    await scenarioPage.openScenarioByTestId(newScenarioData.name!);

    await scenarioPage.openScenarioModalUpdate();

    await scenarioPage.clickScenarioDeleteConfirmBtn();

    await playwrightHomePage.goToHomePage();
    await playwrightHomePage.goToOperationalStudiesPage();
    await projectPage.openProjectByTestId(newProjectData.name);
    await studyPage.openStudyByTestId(newStudyData.name);

    await expect(scenarioPage.getScenarioByName(newScenarioData.name!)).not.toBeVisible();
  });
});
