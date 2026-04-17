import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  electricRollingStockName,
  timetableItemProjectName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import {
  ADDED_EXCEPTION_MENU_BUTTONS,
  ADDED_AND_MODIFIED_EXCEPTION_MENU_BUTTONS,
  CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  DISABLED_OCCURRENCE_MENU_BUTTONS,
  EDITED_OCCURRENCE_NAME,
  EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  INITIAL_OCCURRENCE_NAME,
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

test.describe(
  'Paced train occurrence edition',
  { tag: ['@op', '@paced-trains', '@exceptions'] },
  () => {
    //TODO: remove ignorePageErrors when issue #13066 is resolved
    test.use({ ignorePageErrors: true });

    let project: Project;
    let study: Study;
    let infra: Infra;

    let scenarioItems: Scenario;

    test.beforeAll(
      'Setup project, study, infra and create scenario with paced trains',
      async () => {
        project = await getProject(timetableItemProjectName);
        study = await getStudy(project.id, timetableItemStudyName);
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
      }
    );

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
    test('Edit an indexed occurrence', async ({ pacedTrainSection, operationalStudiesPage }) => {
      await test.step('Open paced train and check initial menu (first occurrence)', async () => {
        await pacedTrainSection.expandPacedTrainOccurrenceList(0);
        await pacedTrainSection.checkOccurrenceMenuIcon(0);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Edit occurrence name and save', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('edit');
        await operationalStudiesPage.setTrainScheduleName(EDITED_OCCURRENCE_NAME);
        await operationalStudiesPage.updateTimetableItem(
          frTranslations.pacedTrains.updatePacedTrain
        );
        await operationalStudiesPage.checkToastHasBeenLaunched(
          frTranslations.timetable.pacedTrainUpdated
        );
      });

      await test.step('Verify edited occurrence tooltip and menu', async () => {
        await pacedTrainSection.checkExceptionTooltip(
          0,
          frTranslations.timetable.occurrenceType.editedOccurrence +
            frTranslations.timetable.occurrenceChangeGroup.train_name
        );
        await pacedTrainSection.checkOccurrenceMenuIcon(0);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Disable edited occurrence', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('disable');
        await pacedTrainSection.verifyOccurrenceName(0, EDITED_OCCURRENCE_NAME);
        await pacedTrainSection.checkOccurrenceMenuIcon(0);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: DISABLED_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Re-enable edited occurrence', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('enable');
        await pacedTrainSection.verifyOccurrenceName(0, EDITED_OCCURRENCE_NAME);
        await pacedTrainSection.checkOccurrenceMenuIcon(0);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: 0,
          expectedButtons: EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Restore occurrence to initial model', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('restore');
        await pacedTrainSection.verifyOccurrenceName(0, INITIAL_OCCURRENCE_NAME);
      });
    });

    /** *************** Test 2 **************** */
    test('Edit added exception', async ({
      pacedTrainSection,
      operationalStudiesPage,
      rollingStockSelector,
      timesAndStopsTab,
      routeTab,
      simulationSettingsTab,
    }) => {
      const PACED_TRAIN_NUMBER = 4;
      const addedOccurrenceIndex = 1;
      const editedPacedTrainData = trains[PACED_TRAIN_NUMBER];

      await test.step('Open paced train and check initial menu state', async () => {
        await pacedTrainSection.expandPacedTrainOccurrenceList(PACED_TRAIN_NUMBER);
        await pacedTrainSection.checkOccurrenceMenuIcon(addedOccurrenceIndex);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: addedOccurrenceIndex,
          expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Open exception edit menu', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('edit');
        await operationalStudiesPage.checkEditOccurrenceButtonsVisibility();
      });

      await test.step('Modify RS, route, start time and simulation params', async () => {
        await rollingStockSelector.openRollingstockModal();
        await rollingStockSelector.selectRollingStockCard({
          name: electricRollingStockName,
          confirmSelection: true,
        });

        await operationalStudiesPage.openRouteTab();
        await routeTab.performPathfindingByTrigram({
          originTrigram: 'WS',
          destinationTrigram: 'NES',
        });

        await operationalStudiesPage.setTrainScheduleStartTime('02:40', '2024-10-16');

        await operationalStudiesPage.openTimesAndStopsTab();
        await timesAndStopsTab.fillTableCellByStationAndHeader(
          'Mid_East_station',
          frTranslations.timeStopTable.stopTime,
          '18000'
        );

        await operationalStudiesPage.openSimulationSettingsTab();
        await simulationSettingsTab.selectSpeedLimitTagOption('MA100');

        await operationalStudiesPage.submitTimetableItemEdit();
        await operationalStudiesPage.checkToastHasBeenLaunched(
          frTranslations.timetable.pacedTrainUpdated
        );
      });

      await test.step('Check exception tooltip after modifications', async () => {
        await pacedTrainSection.checkExceptionTooltip(
          addedOccurrenceIndex,
          frTranslations.timetable.occurrenceType.addedOccurrence,
          frTranslations.timetable.occurrenceChangeGroup.path_and_schedule as ChangeGroup,
          frTranslations.timetable.occurrenceChangeGroup.rolling_stock as ChangeGroup,
          frTranslations.timetable.occurrenceChangeGroup.speed_limit_tag as ChangeGroup,
          frTranslations.timetable.occurrenceChangeGroup.start_time as ChangeGroup
        );
      });

      await test.step('Check occurrence menu after modifications', async () => {
        await pacedTrainSection.checkOccurrenceMenuIcon(addedOccurrenceIndex);
        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: addedOccurrenceIndex,
          expectedButtons: ADDED_AND_MODIFIED_EXCEPTION_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Restore occurrence to model', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('restore');
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name}/+`,
            startTime: '02:40',
            arrivalTime: '02:47',
          },
          addedOccurrenceIndex
        );

        await pacedTrainSection.checkOccurrenceActionMenu({
          occurrenceIndex: addedOccurrenceIndex,
          expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
          translations: frTranslations,
        });
      });

      await test.step('Delete occurrence and check remaining ones', async () => {
        await pacedTrainSection.clickOccurrenceMenuButton('delete');

        await pacedTrainSection.expectOccurrencesListLength(2);
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 1`,
            startTime: '02:00',
            arrivalTime: '02:07',
          },
          0
        );
        await pacedTrainSection.verifyOccurrenceDetails(
          {
            name: `${editedPacedTrainData.train_name} 3`,
            startTime: '03:00',
            arrivalTime: '03:07',
          },
          1
        );
      });
    });
  }
);
