import type { Infra, Project, Scenario, Study, TrainSchedule } from 'common/api/osrdEditoastApi';

import { trainScheduleProjectName, trainScheduleStudyName } from './assets/constants/project-const';
import test from './page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import createScenario from './utils/scenario';
import sendTrains from './utils/send-trains';
import { deleteScenario } from './utils/teardown-utils';

export type ScenarioContext = {
  project: Project;
  study: Study;
  infra: Infra;
  scenarioItems: Scenario;
};

export type ScenarioFixtureOptions = {
  scenarioNamePrefix: string;
  trains: TrainSchedule[];
  /**
   * - 'suite' (default): a single scenario shared by the whole suite of tests
   * - 'test': a fresh scenario before each test
   */
  scope?: 'suite' | 'test';
  projectName?: string;
  studyName?: string;
};

/**
 * Register the hooks creating an isolated scenario seeded with `trains`, opening it and deleting it
 * once the tests are done.
 *
 * @param options - Scenario name prefix, seeded trains, lifecycle scope and optional project/study.
 * @returns {ScenarioContext} - The project, study, infrastructure and scenario used by the tests.
 */

//TODO: only the simulation-result tests use this fixture so far, the other test files still
// duplicate their scenario setup and teardown code and should be migrated to it as well.

export default function setupScenarioFixture({
  scenarioNamePrefix,
  trains,
  scope = 'suite',
  projectName = trainScheduleProjectName,
  studyName = trainScheduleStudyName,
}: ScenarioFixtureOptions): ScenarioContext {
  const scenarioContext = {} as ScenarioContext;

  test.beforeAll('Fetch shared project, study and infrastructure', async () => {
    scenarioContext.project = await getProject(projectName);
    scenarioContext.study = await getStudy(scenarioContext.project.id, studyName);
    scenarioContext.infra = await getInfra();
  });

  const createScenarioWithTrains = async () => {
    const { scenario, trainScheduleSet } = await createScenario(
      generateUniqueName(scenarioNamePrefix),
      scenarioContext.project.id,
      scenarioContext.study.id,
      scenarioContext.infra.id
    );
    scenarioContext.scenarioItems = scenario;
    await sendTrains(trainScheduleSet.id, trains, scenario.timetable_id);
  };

  const deleteCreatedScenario = () =>
    deleteScenario(scenarioContext.study.id, scenarioContext.scenarioItems.name);

  // 'suite': no test mutates the train schedules
  // 'test': a test does, so each needs its own scenario
  if (scope === 'suite') {
    test.beforeAll('Create a scenario with the testing trains', createScenarioWithTrains);
    test.afterAll('Delete the created scenario', deleteCreatedScenario);
  } else {
    test.beforeEach('Create a scenario with the testing trains', createScenarioWithTrains);
    test.afterEach('Delete the created scenario', deleteCreatedScenario);
  }

  test.beforeEach('Open the scenario', async ({ page }) => {
    const { project, study, scenarioItems, infra } = scenarioContext;
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
  });

  return scenarioContext;
}
