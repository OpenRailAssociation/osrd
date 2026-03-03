import type {
  ElectricalProfileSet,
  Infra,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import { infrastructureName } from '../../assets/constants/project-const';
import {
  SCENARIO_DATA,
  SCENARIO_URLS,
  UPDATED_SCENARIO_DATA,
} from '../../assets/operation-studies/scenario-const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import {
  deleteApiRequest,
  getInfra,
  getProject,
  getStudy,
  setElectricalProfile,
} from '../../utils/api-utils';
import createScenario from '../../utils/scenario';
import { deleteScenario } from '../../utils/teardown-utils';

test.describe('@op @scenario @management', () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;
  let electricalProfileSet: ElectricalProfileSet;

  const createdScenarios: { projectId: number; studyId: number; name: string }[] = [];

  test.beforeAll('Fetch project, study and add electrical profiles ', async () => {
    project = await getProject();
    study = await getStudy(project.id);
    infra = await getInfra();
    electricalProfileSet = await setElectricalProfile();
  });

  test.afterAll('Delete scenarios and electrical profiles', async () => {
    await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
    if (!createdScenarios.length) return;
    await Promise.allSettled(createdScenarios.map((s) => deleteScenario(s.studyId, s.name)));
  });

  /** *************** Test 1 **************** */
  test('@smoke Create a new scenario', async ({ page, scenarioPage }) => {
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
  test('@smoke Update an existing scenario', async ({ page, scenarioPage }) => {
    await test.step('Create a base scenario', async () => {
      ({ project, study, scenario } = await createScenario());
    });

    const updatedScenarioName = generateUniqueName(`${SCENARIO_DATA.name}(updated)`);
    const updatedDetails = {
      ...UPDATED_SCENARIO_DATA,
      name: updatedScenarioName,
    };

    createdScenarios.push({ projectId: project.id, studyId: study.id, name: updatedScenarioName });

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
    await test.step('Create a scenario to delete', async () => {
      ({ project, study, scenario } = await createScenario());
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
