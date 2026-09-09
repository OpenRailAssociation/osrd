import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import { invalidPacedTrainTimetableOutput } from '../../assets/operation-studies/invalid-trains/invalid-paced-train-timetable-output';
import { invalidUniqueTrainTimetableOutput } from '../../assets/operation-studies/invalid-trains/invalid-unique-train-timetable-output';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';
import { readJsonFile } from '../../utils/file-utils';

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe(
  'Invalid train simulation',
  { tag: ['@op', '@paced-trains', '@unique-trains', '@invalid-trains'] },
  () => {
    test.slow(); // TODO remove this once this PR is merged: #16969

    setupScenarioFixture({
      scenarioNamePrefix: 'invalid-train-scenario',
      trains: [...trains.slice(3, 4), ...trains.slice(17, 18)],
      scope: 'test',
    });

    /** *************** Test 1 **************** */
    test(
      'Verify invalid unique train simulation result',
      { tag: '@smoke' },
      async ({ scenarioTimetableSection, pacedTrainSection, timesStopsTablePage }) => {
        await test.step('Project paced train and verify invalid simulation outputs', async () => {
          await pacedTrainSection.projectPacedTrain();
          await scenarioTimetableSection.verifyInvalidTrainSimulationResultsVisibility();
        });
        await scenarioTimetableSection.setTrainListVisible();
        await timesStopsTablePage.verifyTimesStopsTableContent(invalidPacedTrainTimetableOutput);
      }
    );

    /** *************** Test 2 **************** */
    test(
      'Verify invalid paced train simulation result',
      { tag: '@smoke' },
      async ({ scenarioTimetableSection, timesStopsTablePage }) => {
        await test.step('Project invalid train and verify invalid simulation outputs', async () => {
          await scenarioTimetableSection.projectTrain(1);
          await scenarioTimetableSection.verifyInvalidTrainSimulationResultsVisibility();
          await scenarioTimetableSection.setTrainListVisible();
          await timesStopsTablePage.verifyTimesStopsTableContent(invalidUniqueTrainTimetableOutput);
        });
      }
    );
  }
);
