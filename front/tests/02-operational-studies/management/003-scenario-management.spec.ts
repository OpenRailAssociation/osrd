import { expect } from '@playwright/test';

import type {
  ElectricalProfileSet,
  Infra,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import { infrastructureName } from '../../assets/constants/project-const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import {
  deleteApiRequest,
  getInfra,
  getProject,
  getStudy,
  setElectricalProfile,
} from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';
import type { ScenarioData } from '../../utils/types';

const scenarioData: ScenarioData = readJsonFile('tests/assets/operation-studies/scenario.json');

test.describe('@op @scenario @management', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;
  let electricalProfileSet: ElectricalProfileSet;

  const createdScenarios: { projectId: number; studyId: number; name: string }[] = [];

  test.beforeAll('Fetch a project, study and add electrical profile ', async () => {
    project = await getProject();
    study = await getStudy(project.id);
    infra = await getInfra();
    electricalProfileSet = await setElectricalProfile();
  });

  test.afterAll('Delete scenarios and electrical profile', async () => {
    await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
    if (!createdScenarios.length) return;
    const scenariosToDelete = [...createdScenarios];
    await Promise.allSettled(scenariosToDelete.map((s) => deleteScenario(s.studyId, s.name)));
  });

  /** *************** Test 1 **************** */
  test('@smoke Create a new scenario', async ({ page, scenarioPage }) => {
    const scenarioName = generateUniqueName(scenarioData.name);
    createdScenarios.push({
      projectId: project.id,
      studyId: study.id,
      name: scenarioName,
    });

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
  });

  /** *************** Test 2 **************** */
  test('@smoke Update an existing scenario', async ({ page, scenarioPage }) => {
    await test.step('Create a base scenario', async () => {
      ({ project, study, scenario } = await createScenario());
    });

    const updatedScenarioName = generateUniqueName(`${scenarioData.name}(updated)`);
    createdScenarios.push({
      projectId: project.id,
      studyId: study.id,
      name: updatedScenarioName,
    });

    await test.step('Open scenario from study page and wait infra cache', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await scenarioPage.openScenarioByName(scenario.name);
      await waitForInfraStateToBeCached(scenario.infra_id);
    });

    await test.step('Update scenario details', async () => {
      await scenarioPage.updateScenario({
        name: updatedScenarioName,
        description: `${scenario.description} (updated)`,
        tags: ['update-tag'],
      });
    });

    await test.step('Validate updated scenario in scenario page', async () => {
      await scenarioPage.validateScenarioData({
        name: updatedScenarioName,
        description: `${scenario.description} (updated)`,
        infraName: infrastructureName,
        isUpdating: true,
      });
    });

    await test.step('Validate scenario tags in study page list', async () => {
      await page.goto(`/operational-studies/projects/${project.id}/studies/${study.id}`);
      await expect(scenarioPage.getScenarioTags(updatedScenarioName)).toContainText(
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
  });

  /** *************** Test 3 **************** */
  test('Delete a scenario', async ({ page, scenarioPage }) => {
    await test.step('Create a scenario to delete', async () => {
      ({ project, study, scenario } = await createScenario());
    });
    createdScenarios.push({
      projectId: project.id,
      studyId: study.id,
      name: scenario.name,
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
