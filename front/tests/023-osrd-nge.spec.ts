import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import { timetableItemProjectName, timetableItemStudyName } from './assets/constants/project-const';
import test from './logging-fixture';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import OpSimulationResultPage from './pages/operational-studies/simulation-results-page';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import sendTrainSchedules from './utils/train-schedule';

const trainSchedulesJson = readJsonFile<TrainSchedule[]>(
  './tests/assets/train-schedule/train_schedules.json'
);

test.describe('Verify osrd nge conversion', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  let scenarioTimetableSection: ScenarioTimetableSection;
  let simulationResultPage: OpSimulationResultPage;

  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
  });

  test.beforeEach('Open scenario and enable only macro view ', async ({ page }) => {
    [simulationResultPage, scenarioTimetableSection] = [
      new OpSimulationResultPage(page),
      new ScenarioTimetableSection(page),
    ];
    await test.step('Create, open scenario and wait for infra to be loaded', async () => {
      scenarioItems = (
        await createScenario(generateUniqueName('nge-scenario'), project.id, study.id, infra.id)
      ).scenario;

      await sendTrainSchedules(scenarioItems.timetable_id, trainSchedulesJson.slice(4, 5));
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await scenarioTimetableSection.removeViteOverlay();
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Enable macro view while keeping the default train list visible', async () => {
      await simulationResultPage.toggleStd();
      await simulationResultPage.toggleMap();
      await simulationResultPage.toggleSdd();
      await simulationResultPage.toggleTableOutput();
      await simulationResultPage.toggleMacro(false);
      await simulationResultPage.waitForLoaderToDisappear();
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });
});
