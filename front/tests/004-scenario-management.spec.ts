import { test, expect } from '@playwright/test';
import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';
import { v4 as uuidv4 } from 'uuid';
import { PlaywrightHomePage } from './pages/home-page-model';
import scenarioData from './assets/operationStudies/scenario.json';
import ScenarioPage from './pages/scenario-page-model';
import PlaywrightCommonPage from './pages/common-page-model';
import { getInfra, getProject, getStudy, postApiRequest } from './assets/utils';

let smallInfra: Infra;
let project: Project;
let study: Study;
let scenario: Scenario;

test.beforeAll(async () => {
  smallInfra = (await getInfra()) as Infra;
  project = await getProject();
  study = await getStudy(project.id);
});

test.beforeEach(async () => {
  scenario = await postApiRequest(`/api/projects/${project.id}/studies/${study.id}/scenarios`, {
    ...scenarioData,
    name: `${scenarioData.name} ${uuidv4()}`,
    study_id: study.id,
    infra_id: smallInfra.id,
  });
});

// TODO: remove (enabled) when every tests are refactored
test.describe('Test if operationnal study : scenario creation workflow is working properly  (enabled)', () => {
  test('Create a new scenario', async ({ page }) => {
    const playwrightHomePage = new PlaywrightHomePage(page);
    const scenarioPage = new ScenarioPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    expect(scenarioPage.getAddScenarioBtn).toBeVisible();
    await scenarioPage.openScenarioCreationModal();

    const scenarioName = `${scenarioData.name} ${uuidv4()}`;
    await scenarioPage.setScenarioName(scenarioName);

    await scenarioPage.setScenarioDescription(scenarioData.description);

    // Infra created by CI has no electrical profile
    if (!process.env.CI) {
      await scenarioPage.setScenarioElectricProfileByName('small_infra');
    }

    await commonPage.setTag(scenarioData.tags[0]);
    await commonPage.setTag(scenarioData.tags[1]);
    await commonPage.setTag(scenarioData.tags[2]);

    await scenarioPage.setScenarioInfraByName('small_infra_test_e2e');
    const createButton = playwrightHomePage.page.getByTestId('createScenario');
    await createButton.click();
    await playwrightHomePage.page.waitForURL('**/scenarios/*');
    expect(await scenarioPage.getScenarioName.textContent()).toContain(scenarioName);
    expect(await scenarioPage.getScenarioDescription.textContent()).toContain(
      scenarioData.description
    );
    expect(await scenarioPage.getScenarioInfraName.textContent()).toContain('small_infra_test_e2e');
  });

  test('Update a scenario', async ({ page }) => {
    const scenarioPage = new ScenarioPage(page);
    const commonPage = new PlaywrightCommonPage(page);

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    await scenarioPage.openScenarioModalUpdate();

    const scenarioName = `${scenarioData.name} ${uuidv4()}`;
    await scenarioPage.setScenarioName(scenarioName);

    await scenarioPage.setScenarioDescription(`${scenario.description!} (updated)`);

    await commonPage.setTag('update-tag');

    await scenarioPage.clickScenarioUpdateConfirmBtn();

    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    expect(await scenarioPage.getScenarioTags(scenarioName).textContent()).toContain(
      `${scenarioData.tags.join('')}update-tag`
    );

    await scenarioPage.openScenarioByTestId(scenarioName);

    expect(await scenarioPage.getScenarioName.textContent()).toContain(scenarioName);
    expect(await scenarioPage.getScenarioDescription.textContent()).toContain(
      `${scenario.description!} (updated)`
    );
  });

  test('Delete a scenario', async ({ page }) => {
    const scenarioPage = new ScenarioPage(page);

    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
    );

    await scenarioPage.openScenarioModalUpdate();

    await scenarioPage.clickScenarioDeleteConfirmBtn();

    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    await expect(scenarioPage.getScenarioByName(scenario.name!)).not.toBeVisible();
  });
});
