import { expect } from '@playwright/test';

import type { ElectricalProfileSet, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import scenarioData from './assets/operationStudies/scenario.json';
import ScenarioPage from './pages/scenario-page-model';
import test from './test-logger';
import { generateUniqueName } from './utils';
import { deleteApiRequest, getProject, getStudy, setElectricalProfile } from './utils/api-setup';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';

test.describe('Validate the Scenario creation workflow', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let electricalProfileSet: ElectricalProfileSet;

  test.beforeAll('Fetch a project, study and add electrical profile ', async () => {
    project = await getProject();
    study = await getStudy(project.id);
    electricalProfileSet = await setElectricalProfile();
  });

  test.afterAll('Delete the electrical profile', async () => {
    deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
  });

  /** *************** Test 1 **************** */
  test('Create a new scenario', async ({ page }) => {
    const scenarioPage = new ScenarioPage(page);

    // Navigate to the study page for the selected project
    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    const scenarioName = generateUniqueName(scenarioData.name); // Generate a unique scenario name

    // Create a new scenario using the scenario page model
    await scenarioPage.createScenario({
      name: scenarioName,
      description: scenarioData.description,
      infraName: 'small_infra_test_e2e',
      tags: scenarioData.tags,
      electricProfileName: electricalProfileSet.name,
    });

    // Validate that the scenario was created with the correct data
    await scenarioPage.validateScenarioData({
      name: scenarioName,
      description: scenarioData.description,
      infraName: 'small_infra_test_e2e',
    });
    await deleteScenario(project.id, study.id, scenarioName);
  });

  /** *************** Test 2 **************** */
  test('Update an existing scenario', async ({ page }) => {
    // Set up a scenario
    ({ project, study, scenario } = await createScenario());

    const scenarioPage = new ScenarioPage(page);

    // Navigate to the specific scenario page
    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
    await scenarioPage.openScenarioByTestId(scenario.name);

    // Update the scenario with new details
    const updatedScenarioName = generateUniqueName(`${scenarioData.name}(updated)`);
    await scenarioPage.updateScenario({
      name: updatedScenarioName,
      description: `${scenario.description} (updated)`,
      tags: ['update-tag'],
    });

    // Navigate back to the study page to verify the updated tags
    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    // Assert that the updated tags include the new 'update-tag'
    expect(await scenarioPage.getScenarioTags(updatedScenarioName).textContent()).toContain(
      `${scenarioData.tags.join('')}update-tag`
    );

    // Reopen the updated scenario and validate the updated data
    await scenarioPage.openScenarioByTestId(updatedScenarioName);
    await scenarioPage.validateScenarioData({
      name: updatedScenarioName,
      description: `${scenario.description} (updated)`,
      infraName: 'small_infra_test_e2e',
    });

    // Delete the scenario
    await deleteScenario(project.id, study.id, updatedScenarioName);
  });

  /** *************** Test 3 **************** */
  test('Delete a scenario', async ({ page }) => {
    // Set up a scenario
    ({ project, study, scenario } = await createScenario());

    // Navigate to the specific scenario page
    const scenarioPage = new ScenarioPage(page);
    // Navigate to the specific scenario page
    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
    await scenarioPage.openScenarioByTestId(scenario.name);

    // Initiate the deletion of the scenario
    await scenarioPage.clickOnUpdateScenario();
    await scenarioPage.deleteScenario();

    // Navigate back to the study page
    await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);

    // Ensure that the scenario is no longer visible
    await expect(scenarioPage.getScenarioByName(scenario.name)).not.toBeVisible();
  });
});
