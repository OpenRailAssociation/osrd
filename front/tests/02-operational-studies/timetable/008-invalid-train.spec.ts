import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  trainScheduleProjectName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import { invalidPacedTrainTimetableOutput } from '../../assets/operation-studies/invalid-trains/invalid-paced-train-timetable-output';
import { invalidUniqueTrainTimetableOutput } from '../../assets/operation-studies/invalid-trains/invalid-unique-train-timetable-output';
import test from '../../logging-fixture';
import PacedTrainSection from '../../pages/operational-studies/paced-train-section';
import ScenarioTimetableSection from '../../pages/operational-studies/scenario-timetable-section';
import TimeAndStopSimulationOutputs from '../../pages/operational-studies/time-stop-simulation-outputs';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe(
  'Invalid train simulation',
  { tag: ['@op', '@paced-trains', '@unique-trains', '@invalid-trains'] },
  () => {
    let project: Project;
    let study: Study;
    let scenarioItems: Scenario;
    let infra: Infra;
    let scenarioTimetableSection: ScenarioTimetableSection;
    let pacedTrainSection: PacedTrainSection;
    let timeAndStopSimulationOutputs: TimeAndStopSimulationOutputs;

    test.beforeAll('Fetch project, study and infrastructure', async () => {
      project = await getProject(trainScheduleProjectName);
      study = await getStudy(project.id, trainScheduleStudyName);
      infra = await getInfra();
    });

    test.beforeEach('Setup scenario with invalid trains', async ({ page }) => {
      scenarioTimetableSection = new ScenarioTimetableSection(page);
      pacedTrainSection = new PacedTrainSection(page);
      timeAndStopSimulationOutputs = new TimeAndStopSimulationOutputs(page);
      scenarioItems = (
        await createScenario(
          generateUniqueName('invalid-train-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;

      const selectedTrains = [...trains.slice(3, 4), ...trains.slice(17, 18)];
      await sendTrains(scenarioItems.timetable_id, selectedTrains);

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    });

    test.afterAll('Delete the created scenario', async () => {
      await deleteScenario(study.id, scenarioItems.name);
    });

    /** *************** Test 1 **************** */
    test('Verify invalid train simulation result', { tag: '@smoke' }, async () => {
      await test.step('Project paced train and verify invalid simulation outputs', async () => {
        await pacedTrainSection.projectPacedTrain();
        await scenarioTimetableSection.verifyInvalidTrainSimulationResultsVisibility();
      });
      await timeAndStopSimulationOutputs.getOutputTableData(invalidPacedTrainTimetableOutput);
      await test.step('Project invalid train and verify invalid simulation outputs', async () => {
        await scenarioTimetableSection.projectTrain(1);
        await scenarioTimetableSection.verifyInvalidTrainSimulationResultsVisibility();
        await timeAndStopSimulationOutputs.getOutputTableData(invalidUniqueTrainTimetableOutput);
      });
    });
  }
);
