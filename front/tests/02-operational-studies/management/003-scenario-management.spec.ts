import type { ElectricalProfileSet, Scenario } from 'common/api/osrdEditoastApi';

import {
  globalProjectName,
  globalStudyName,
  infrastructureName,
} from '../../assets/constants/project-const';
import {
  SCENARIO_DATA,
  SCENARIO_URLS,
  UPDATED_SCENARIO_DATA,
} from '../../assets/operation-studies/scenario-const';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { deleteApiRequest, setElectricalProfile } from '../../utils/api-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';

test.describe('Scenario management', { tag: ['@op', '@scenario', '@management'] }, () => {
  let scenario: Scenario;
  let electricalProfileSet: ElectricalProfileSet;

  const createdScenarios: { projectId: number; studyId: number; name: string }[] = [];

  const scenarioContext = setupScenarioFixture({
    scenarioNamePrefix: 'scenario-management-scenario',
    trains: [],
    scope: 'none',
    projectName: globalProjectName,
    studyName: globalStudyName,
  });

  test.beforeAll('Add electrical profiles', async () => {
    electricalProfileSet = await setElectricalProfile();
  });

  test.afterAll('Delete scenarios and electrical profiles', async () => {
    await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
    if (!createdScenarios.length) return;
    await Promise.allSettled(createdScenarios.map((s) => deleteScenario(s.studyId, s.name)));
  });

  /** *************** Test 1 **************** */
  test('Create a new scenario', { tag: '@smoke' }, async ({ page, scenarioPage }) => {
    const { project, study, infra } = scenarioContext;
    const scenarioName = generateUniqueName(SCENARIO_DATA.name);
    createdScenarios.push({ projectId: project.id, studyId: study.id, name: scenarioName });

    const scenarioDetails = {
      name: scenarioName,
      description: SCENARIO_DATA.description,
      infraName: infrastructureName,
      tags: SCENARIO_DATA.tags,
      electricProfileName: electricalProfileSet.name,
    };

    await test.step('Navigate to study page', async () => {
      await page.goto(SCENARIO_URLS.study(project.id, study.id));
    });

    await test.step('Create scenario via UI', async () => {
      await scenarioPage.createScenario(scenarioDetails);
      await waitForInfraStateToBeCached(infra.id);
    });

    await test.step('Validate created scenario data', async () => {
      await scenarioPage.validateScenarioData({
        name: scenarioName,
        description: SCENARIO_DATA.description,
        infraName: infrastructureName,
      });
    });
  });

  /** *************** Test 2 **************** */
  test('Update an existing scenario', { tag: '@smoke' }, async ({ page, scenarioPage }) => {
    const { project, study } = scenarioContext;
    await test.step('Create a base scenario', async () => {
      ({ scenario } = await createScenario());
    });

    const updatedScenarioName = generateUniqueName(`${SCENARIO_DATA.name}(updated)`);
    const updatedDetails = {
      ...UPDATED_SCENARIO_DATA,
      name: updatedScenarioName,
    };

    createdScenarios.push({
      projectId: project.id,
      studyId: study.id,
      name: updatedScenarioName,
    });

    await test.step('Open scenario from study page and wait for infra cache', async () => {
      await page.goto(SCENARIO_URLS.study(project.id, study.id));
      await scenarioPage.openScenarioByName(scenario.name);
      await waitForInfraStateToBeCached(scenario.infra_id);
    });

    await test.step('Update scenario details', async () => {
      await scenarioPage.updateScenario(updatedDetails);
    });

    await test.step('Validate updated scenario data', async () => {
      await scenarioPage.validateScenarioData({
        name: updatedScenarioName,
        description: UPDATED_SCENARIO_DATA.description,
        infraName: infrastructureName,
        isUpdating: true,
      });
    });

    await test.step('Validate scenario tags in study page list', async () => {
      await page.goto(SCENARIO_URLS.study(project.id, study.id));
      await scenarioPage.expectScenarioTags(
        updatedScenarioName,
        `${SCENARIO_DATA.tags.join('')}${UPDATED_SCENARIO_DATA.tags}`
      );
    });

    await test.step('Reopen updated scenario and re-validate', async () => {
      await scenarioPage.openScenarioByName(updatedScenarioName);
      await scenarioPage.validateScenarioData({
        name: updatedScenarioName,
        description: UPDATED_SCENARIO_DATA.description,
        infraName: infrastructureName,
      });
    });
  });

  /** *************** Test 3 **************** */
  test('Delete a scenario', async ({ page, scenarioPage }) => {
    const { project, study, infra } = scenarioContext;
    await test.step('Create a scenario to delete', async () => {
      ({ scenario } = await createScenario());
      createdScenarios.push({ projectId: project.id, studyId: study.id, name: scenario.name });
    });

    await test.step('Navigate to study page', async () => {
      await page.goto(SCENARIO_URLS.study(project.id, study.id));
    });

    await test.step('Open scenario and delete via edit form', async () => {
      await scenarioPage.openScenarioByName(scenario.name);
      await waitForInfraStateToBeCached(infra.id);
      await scenarioPage.openScenarioEditForm();
      await scenarioPage.deleteScenario();
    });

    await test.step('Verify scenario no longer visible in study page', async () => {
      await page.goto(SCENARIO_URLS.study(project.id, study.id));
      await scenarioPage.assertScenarioNotVisible(scenario.name);
    });
  });
});
