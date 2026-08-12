import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  fastRollingStockName,
  trainScheduleProjectName,
  trainScheduleStudyName,
} from '../../assets/constants/project-const';
import {
  ADDED_EXCEPTION_DATE,
  ADDED_EXCEPTION_MENU_BUTTONS,
  ADDED_EXCEPTION_OCCURRENCE_DETAILS,
  ADDED_EXCEPTION_OCCURRENCES_COUNT,
  ADDED_EXCEPTION_SERVICE_WINDOW_HOURS,
  ADDED_EXCEPTION_SERVICE_WINDOW_MINUTES,
  ADDED_EXCEPTION_INTERVAL_MINUTES,
  ADDED_EXCEPTION_TIME,
  EDITED_EXCEPTION_NEW_REQUESTED_ARRIVAL,
  EDITED_EXCEPTION_OCCURRENCES_AFTER_RESET,
  EDITED_EXCEPTION_OCCURRENCES_WITH_EXCEPTIONS,
} from '../../assets/paced-train/const';
import test from '../../page-object-fixture';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type {
  ChangeGroup,
  CommonTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';

const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const frTranslations = {
  ...frManageTrainScheduleTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.describe('Paced train exceptions', { tag: ['@op', '@paced-trains', '@exceptions'] }, () => {
  //TODO: remove ignorePageErrors when issue #13066 is resolved
  test.use({ ignorePageErrors: true });
  let project: Project;
  let study: Study;
  let infra: Infra;

  let scenarioItems: Scenario;

  test.beforeAll('Setup project, study, infra and create scenario with paced trains', async () => {
    project = await getProject(trainScheduleProjectName);
    study = await getStudy(project.id, trainScheduleStudyName);
    infra = await getInfra();
    const { scenario, trainScheduleSet } = await createScenario(
      generateUniqueName('paced-trains-scenario'),
      project.id,
      study.id,
      infra.id
    );
    scenarioItems = scenario;
    const trainsSubset = trains.slice(0, 6);
    await sendTrains(trainScheduleSet.id, trainsSubset, scenarioItems.timetable_id);
  });

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page }) => {
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    }
  );

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenarioItems.name);
  });

  /** *************** Test 1 **************** */
  test(
    'Edit a paced train and handle exceptions',
    { tag: '@smoke' },
    async ({ pacedTrainSection, headerPage, timesStopsTablePage }) => {
      await test.step('Open action buttons for paced train at index 5', async () => {
        await pacedTrainSection.getActionButtonsLocators({
          trainIndex: 5,
          trainType: 'paced-train',
          withExceptions: true,
          checkVisibility: true,
        });
      });

      await test.step('Update rolling stock via the header', async () => {
        await pacedTrainSection.selectPacedTrainModel(5);
        await headerPage.expandHeader();
        await headerPage.setRollingStock(fastRollingStockName);
      });

      await test.step('Update departure time via the times and stops table', async () => {
        const originRow = timesStopsTablePage.getRow(0);
        await timesStopsTablePage.editRequestedArrival(
          originRow,
          EDITED_EXCEPTION_NEW_REQUESTED_ARRIVAL
        );
        await timesStopsTablePage.waitForSimulation();
      });

      await test.step('Verify all occurrences (4 occurrences including 1 added exception)', async () => {
        await pacedTrainSection.expandPacedTrainOccurrenceList(5);
        for (const [index, occurrence] of EDITED_EXCEPTION_OCCURRENCES_WITH_EXCEPTIONS.entries()) {
          await pacedTrainSection.verifyOccurrenceDetails(occurrence, index);
        }
      });

      await test.step('Reset all exceptions', async () => {
        await pacedTrainSection.resetAllPacedTrainExceptions(5);
      });

      await test.step('Verify occurrences after reset', async () => {
        for (const [index, occurrence] of EDITED_EXCEPTION_OCCURRENCES_AFTER_RESET.entries()) {
          await pacedTrainSection.verifyOccurrenceDetails(occurrence, index);
        }
      });

      await test.step('Check action buttons count after reset (4 buttons instead of 5)', async () => {
        await pacedTrainSection.getActionButtonsLocators({
          trainIndex: 5,
          trainType: 'paced-train',
          checkVisibility: true,
        });
      });
    }
  );

  /** *************** Test 2 **************** */
  test('Modify a paced train and create added exception', async ({
    page,
    pacedTrainSection,
    headerPage,
    timesStopsTablePage,
  }) => {
    await test.step('Select the paced train and expand the header', async () => {
      await pacedTrainSection.selectPacedTrainModel(1);
      await headerPage.expandHeader();
    });

    await test.step('Check cadence and window before adding an exception', async () => {
      await headerPage.verifyServiceCadenceAndWindow(
        ADDED_EXCEPTION_INTERVAL_MINUTES,
        ADDED_EXCEPTION_SERVICE_WINDOW_HOURS,
        ADDED_EXCEPTION_SERVICE_WINDOW_MINUTES
      );
      await headerPage.verifyExtraOccurrencesToggleLabel(0);
    });

    await test.step('Add an exception for the paced train', async () => {
      await headerPage.toggleExtraOccurrences();
      await headerPage.createExtraOccurrence(ADDED_EXCEPTION_DATE, ADDED_EXCEPTION_TIME);
      await timesStopsTablePage.waitForSimulation();
    });

    await test.step('Verify the occurrences count (5)', async () => {
      await pacedTrainSection.expandPacedTrainOccurrenceList(1);
      await pacedTrainSection.expectOccurrencesListLength(ADDED_EXCEPTION_OCCURRENCES_COUNT);
    });

    await test.step('Verify details of the added exception occurrence (index 4)', async () => {
      try {
        await pacedTrainSection.verifyOccurrenceDetails(ADDED_EXCEPTION_OCCURRENCE_DETAILS, 4);
      } catch {
        // TODO: remove the try catch when this https://github.com/OpenRailAssociation/osrd/issues/17794 is resolved
        await page.reload();
        await pacedTrainSection.selectPacedTrainModel(1);
        await pacedTrainSection.expandPacedTrainOccurrenceList(1);
        await pacedTrainSection.verifyOccurrenceDetails(ADDED_EXCEPTION_OCCURRENCE_DETAILS, 4);
      }
    });

    await test.step('Check tooltip and occurrence menu for added exception', async () => {
      await pacedTrainSection.checkExceptionTooltip(
        4,
        frTranslations.timetable.occurrenceType.addedOccurrence,
        frTranslations.timetable.occurrenceChangeGroup.start_time as ChangeGroup
      );

      await pacedTrainSection.checkOccurrenceActionMenu({
        occurrenceIndex: 4,
        expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
        translations: frTranslations,
      });
    });
  });
});
