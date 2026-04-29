import type { Scenario, Project, Study, Infra } from 'common/api/osrdEditoastApi';

import {
  IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS,
  IMPORTED_PACED_TRAIN_DETAILS,
} from '../../assets/constants/operational-studies-const';
import {
  trainScheduleProjectName,
  trainScheduleScenarioName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import {
  TOTAL_TRAIN_SCHEDULES,
  TOTAL_PACED_TRAINS,
  TOTAL_UNIQUE_TRAINS,
  VALID_PACED_TRAINS,
  VALID_UNIQUE_TRAIN,
} from '../../assets/constants/train-schedules-count';
import test from '../../page-object-fixture';
import { waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getScenario, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import type { CommonTranslations, TimetableFilterTranslations } from '../../utils/types';

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

// TODO: Properly count trains even if the virtualised train list does not render them yet;
//       this workaround simply makes the viewport bigger so the whole list is rendered.
test.use({ viewport: { width: 1920, height: 1920 } });

test.describe('Train schedules management', { tag: ['@op', '@train-schedules'] }, () => {
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and scenario with unique train', async () => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
    scenario = await getScenario(study.id, trainScheduleScenarioName);
    infra = await getInfra();
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page }) => {
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    }
  );

  /** *************** Test 1 **************** */
  test(
    'Loading train schedules and verifying simulation result for unique trains',
    { tag: '@smoke' },
    async ({ scenarioTimetableSection }) => {
      await test.step('Verify counts then filter valid unique trains', async () => {
        await scenarioTimetableSection.verifyTrainSchedulesCount(TOTAL_TRAIN_SCHEDULES);
        await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount(
          'Unique train',
          TOTAL_UNIQUE_TRAINS
        );
        await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
          'Valid',
          VALID_UNIQUE_TRAIN,
          frTranslations
        );
      });

      await test.step('Verify simulation results for valid unique trains', async () => {
        await scenarioTimetableSection.verifyEachUniqueTrainSimulation(VALID_UNIQUE_TRAIN);
      });
    }
  );

  /** *************** Test 2 **************** */
  test('Loading train schedules and verifying simulation result for paced trains', async ({
    scenarioTimetableSection,
  }) => {
    test.slow(); // Verifying all occurrences of paced trains can take some time, this test will be reworked later to optimize it
    await test.step('Verify invalid message, then filter valid paced trains', async () => {
      await scenarioTimetableSection.verifyInvalidTrainsMessageVisibility();
      await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount(
        'Service',
        TOTAL_PACED_TRAINS
      );
      await scenarioTimetableSection.filterValidityAndVerifyTrainCount(
        'Valid',
        VALID_PACED_TRAINS,
        frTranslations
      );
    });

    await test.step('Verify paced train simulation results', async () => {
      await scenarioTimetableSection.verifyPacedTrainSimulations(VALID_PACED_TRAINS);
    });
  });

  /** *************** Test 3 **************** */
  test('Loading train schedules and verifying paced trains display', async ({
    scenarioTimetableSection,
    pacedTrainSection,
  }) => {
    await test.step('Verify each imported paced train card and its occurrences', async () => {
      await scenarioTimetableSection.filterTrainTypeAndVerifyTrainCount(
        'Service',
        TOTAL_PACED_TRAINS
      );
      for (let pacedTrainIndex = 0; pacedTrainIndex < 7; pacedTrainIndex += 1) {
        await pacedTrainSection.verifyPacedTrainItemDetails(
          IMPORTED_PACED_TRAIN_DETAILS[pacedTrainIndex],
          pacedTrainIndex,
          {
            occurrenceData: IMPORT_PACED_TRAIN_OCCURRENCES_DETAILS[pacedTrainIndex],
          }
        );
      }
    });
  });
});
