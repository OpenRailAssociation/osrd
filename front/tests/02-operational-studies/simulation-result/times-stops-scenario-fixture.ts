import type { Infra, Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import {
  SCENARIO_NAME_PREFIX,
  myTrain,
} from '../../assets/operation-studies/simulation-result/times-stops-table-const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';

export type TimesStopsScenarioContext = {
  project: Project;
  study: Study;
  scenarioItems: Scenario;
  infra: Infra;
};

//TODO: this fixture is currently used in two separate test files, it can be more generic so some existing tests can be migrated to use it as well, to avoid duplicated scenario setup and teardown code.
export default function setupScenarioWithTrain(): TimesStopsScenarioContext {
  const scenarioContext = {} as TimesStopsScenarioContext;

  test.beforeAll('Create scenario with a testing train', async () => {
    scenarioContext.project = await getProject(trainScheduleProjectName);
    scenarioContext.study = await getStudy(scenarioContext.project.id, trainScheduleStudyName);
    scenarioContext.infra = await getInfra();
    const { scenario, trainScheduleSet } = await createScenario(
      generateUniqueName(SCENARIO_NAME_PREFIX),
      scenarioContext.project.id,
      scenarioContext.study.id,
      scenarioContext.infra.id
    );
    scenarioContext.scenarioItems = scenario;
    await sendTrains(trainScheduleSet.id, myTrain);
  });

  test.beforeEach(
    'Open scenario and wait for times-stops table',
    async ({ page, scenarioTimetableSection }) => {
      await page.goto(
        `/operational-studies/projects/${scenarioContext.project.id}/studies/${scenarioContext.study.id}/scenarios/${scenarioContext.scenarioItems.id}`
      );
      await waitForInfraStateToBeCached(scenarioContext.infra.id);
      await scenarioTimetableSection.enableOnlyTimesStopsTable();
      await scenarioTimetableSection.verifyTimesStopsDataSheetVisibility();
    }
  );

  test.afterAll('Delete created scenario', async () => {
    await deleteScenario(scenarioContext.study.id, scenarioContext.scenarioItems.name);
  });

  return scenarioContext;
}
