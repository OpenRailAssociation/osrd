import { expect } from '@playwright/test';

import type {
  ElectricalProfileSet,
  Infra,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import { infrastructureName } from './assets/constants/project-const';
import test from './logging-fixture';
import ScenarioPage from './pages/operational-studies/scenario-page';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import {
  deleteApiRequest,
  getInfra,
  getProject,
  getStudy,
  setElectricalProfile,
} from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import type { ScenarioData } from './utils/types';

const scenarioData: ScenarioData = readJsonFile('tests/assets/operation-studies/scenario.json');

test.describe('Validate the Scenario creation workflow', () => {
  let scenarioPage: ScenarioPage;

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;
  let electricalProfileSet: ElectricalProfileSet;

  test.beforeAll('Fetch a project, study and add electrical profile ', async () => {
    project = await getProject();
    study = await getStudy(project.id);
    infra = await getInfra();
    electricalProfileSet = await setElectricalProfile();
  });

  test.afterAll('Delete the electrical profile', async () => {
    await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
  });

  test.beforeEach(async ({ page }) => {
    scenarioPage = new ScenarioPage(page);
  });

  /** *************** Test 1 **************** */
  test('Create a new scenario', async ({ page }) => {
    const scenarioName = generateUniqueName(scenarioData.name);

    await test.step('Navigate to study page', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
    });

    await test.step('Create scenario via UI', async () => {
      await scenarioPage.createScenario({
        name: scenarioName,
        description: scenarioData.description,
        infraName: infrastructureName,
        tags: scenarioData.tags,
        electricProfileName: electricalProfileSet.name,
      });
      await waitForInfraStateToBeCached(infra.id);
    });

    await test.step('Validate created scenario data', async () => {
      await scenarioPage.validateScenarioData({
        name: scenarioName,
        description: scenarioData.description,
        infraName: infrastructureName,
      });
    });

    await test.step('Delete created scenario', async () => {
      await deleteScenario(project.id, study.id, scenarioName);
    });
  });

  /** *************** Test 2 **************** */
  test('Update an existing scenario', async ({ page }) => {
    await test.step('Create a base scenario', async () => {
      ({ project, study, scenario } = await createScenario());
    });

    await test.step('Open scenario from study page and wait infra cache', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await scenarioPage.openScenarioByName(scenario.name);
      await waitForInfraStateToBeCached(scenario.infra_id);
    });

    const updatedScenarioName = generateUniqueName(`${scenarioData.name}(updated)`);
    await test.step('Update scenario details', async () => {
      await scenarioPage.updateScenario({
        name: updatedScenarioName,
        description: `${scenario.description} (updated)`,
        tags: ['update-tag'],
      });
    });

    await test.step('Validate updated scenario (in scenario page)', async () => {
      await scenarioPage.validateScenarioData({
        name: updatedScenarioName,
        description: `${scenario.description} (updated)`,
        infraName: infrastructureName,
        isUpdating: true,
      });
    });

    await test.step('Validate scenario tags in study page list', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      expect(await scenarioPage.getScenarioTags(updatedScenarioName).textContent()).toContain(
        `${scenarioData.tags.join('')}update-tag`
      );
    });

    await test.step('Reopen updated scenario and re-validate', async () => {
      await scenarioPage.openScenarioByName(updatedScenarioName);
      await scenarioPage.validateScenarioData({
        name: updatedScenarioName,
        description: `${scenario.description} (updated)`,
        infraName: infrastructureName,
      });
    });

    await test.step('Delete updated scenario', async () => {
      await deleteScenario(project.id, study.id, updatedScenarioName);
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a scenario', async ({ page }) => {
    await test.step('Create a scenario to delete', async () => {
      ({ project, study, scenario } = await createScenario());
    });

    await test.step('Open scenario and delete via edit form', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await scenarioPage.openScenarioByName(scenario.name);
      await waitForInfraStateToBeCached(infra.id);
      await scenarioPage.openScenarioEditForm();
      await scenarioPage.deleteScenario();
    });

    await test.step('Verify scenario no longer visible in study page', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await expect(scenarioPage.getScenarioByName(scenario.name)).not.toBeVisible();
    });
  });
});
