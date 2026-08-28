import type { TrainSchedule } from 'common/api/osrdEditoastApi';

import { invalidPacedTrainTimetableOutput } from '../../assets/operation-studies/invalid-trains/invalid-paced-train-timetable-output';
import { invalidUniqueTrainTimetableOutput } from '../../assets/operation-studies/invalid-trains/invalid-unique-train-timetable-output';
import { invalidUniqueTrainWithReferenceBaseArrivalOutput } from '../../assets/operation-studies/invalid-trains/invalid-unique-train-with-reference-base-arrival-output';
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

    /** *************** Test 3 **************** */
    test(
      'Reference base arrival editing on an invalid train',
      { tag: '@smoke' },
      async ({ scenarioTimetableSection, timesStopsTablePage }) => {
        await scenarioTimetableSection.projectTrain(1);
        await scenarioTimetableSection.setTrainListVisible();

        // Row 1 (0-indexed) is the first via point after the origin; since the simulation is
        // invalid, its base arrival column renders an editable input instead of a computed value.
        const viaRow = timesStopsTablePage.getRow(1);

        await test.step('Verify reference base arrival is present', async () => {
          await timesStopsTablePage.verifyReferenceBaseArrivalInputVisible(viaRow);
        });

        await test.step('Edit reference base arrival and verify margins get computed', async () => {
          const previousValue = await timesStopsTablePage.getReferenceBaseArrivalInputValue(viaRow);
          await timesStopsTablePage.editReferenceBaseArrival(viaRow, '11:47:00');
          await timesStopsTablePage.editRequestedArrival(viaRow, '11:46:00');
          await timesStopsTablePage.verifyReferenceBaseArrivalChanged(viaRow, previousValue);
          await timesStopsTablePage.verifyTimesStopsTableContent(
            invalidUniqueTrainWithReferenceBaseArrivalOutput
          );
        });
      }
    );
  }
);
