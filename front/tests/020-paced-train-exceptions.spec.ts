import { expect } from '@playwright/test';

import type { Scenario, Project, Study, Infra, PacedTrain } from 'common/api/osrdEditoastApi';

import {
  electricRollingStockName,
  fastRollingStockName,
  slowRollingStockName,
  timetableItemProjectName,
  timetableItemStudyName,
} from './assets/constants/project-const';
import {
  ADDED_EXCEPTION_MENU_BUTTONS,
  ADDED_AND_MODIFIED_EXCEPTION_MENU_BUTTONS,
  CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  DISABLED_OCCURRENCE_MENU_BUTTONS,
  EDITED_OCCURRENCE_NAME,
  EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  INITIAL_OCCURRENCE_NAME,
} from './assets/paced-train/const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import PacedTrainSection from './pages/operational-studies/paced-train-section';
import RouteTab from './pages/operational-studies/route-tab';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import SimulationSettingsTab from './pages/operational-studies/simulation-settings-tab';
import TimesAndStopsTab from './pages/operational-studies/times-and-stops-tab';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { generateUniqueName, waitForInfraStateToBeCached } from './utils';
import { getInfra, getProject, getStudy } from './utils/api-utils';
import readJsonFile from './utils/file-utils';
import { sendPacedTrains } from './utils/paced-train';
import createScenario from './utils/scenario';
import { deleteScenario } from './utils/teardown-utils';
import type {
  ChangeGroup,
  CommonTranslations,
  ManageTimetableItemTranslations,
  TimetableFilterTranslations,
} from './utils/types';

const frManageTimetableItemTranslations: ManageTimetableItemTranslations = readJsonFile<{
  manageTimetableItem: ManageTimetableItemTranslations;
}>('public/locales/fr/operational-studies.json').manageTimetableItem;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');

const frTranslations: ManageTimetableItemTranslations &
  TimetableFilterTranslations &
  CommonTranslations = {
  ...frManageTimetableItemTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const pacedTrainsJson = readJsonFile<PacedTrain[]>('./tests/assets/paced-train/paced_trains.json');

test.describe('Paced trains and exception management', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let project: Project;
  let study: Study;
  let infra: Infra;

  let scenarioTimetableSection: ScenarioTimetableSection;
  let operationalStudiesPage: OperationalStudiesPage;
  let pacedTrainSection: PacedTrainSection;
  let rollingStockSelector: RollingStockSelector;
  let routeTab: RouteTab;
  let timesAndStopsTab: TimesAndStopsTab;
  let simulationSettingsTab: SimulationSettingsTab;

  let scenarioItems: Scenario;

  test.beforeAll(
    'Setup project, study, infra and create scenario with timetableItems',
    async () => {
      project = await getProject(timetableItemProjectName);
      study = await getStudy(project.id, timetableItemStudyName);
      infra = await getInfra();
      scenarioItems = (
        await createScenario(
          generateUniqueName('edit-train-scenario'),
          project.id,
          study.id,
          infra.id
        )
      ).scenario;
      await sendPacedTrains(scenarioItems.timetable_id, pacedTrainsJson.slice(0, 6));
    }
  );

  test.beforeEach(
    'Navigate to scenario page and wait for infrastructure to be loaded',
    async ({ page }) => {
      [
        pacedTrainSection,
        scenarioTimetableSection,
        operationalStudiesPage,
        rollingStockSelector,
        routeTab,
        timesAndStopsTab,
        simulationSettingsTab,
      ] = [
        new PacedTrainSection(page),
        new ScenarioTimetableSection(page),
        new OperationalStudiesPage(page),
        new RollingStockSelector(page),
        new RouteTab(page),
        new TimesAndStopsTab(page),
        new SimulationSettingsTab(page),
      ];

      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
      );
      await waitForInfraStateToBeCached(infra.id);
    }
  );

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenarioItems.name);
  });

  /** *************** Test 1 **************** */
  test('Edit a paced train and handle exceptions', async () => {
    const editedPacedTrainData = pacedTrainsJson[5];

    await test.step('Open action buttons for paced train at index 5', async () => {
      await pacedTrainSection.getActionButtonsLocators({
        itemIndex: 5,
        itemType: 'paced-train',
        withExceptions: true,
        checkVisibility: true,
      });
    });

    await test.step('Edit the paced train', async () => {
      await pacedTrainSection.openPacedTrainEditor(5);
      await scenarioTimetableSection.verifyEditTimetableItemButtonVisibility();
    });

    await test.step('Update rolling stock', async () => {
      await rollingStockSelector.openRollingstockModal();
      await rollingStockSelector.searchRollingstock(fastRollingStockName);
      await rollingStockSelector.selectRollingStockCard({
        name: fastRollingStockName,
        selectComfort: false,
        confirmSelection: true,
      });
      expect(await rollingStockSelector.selectedRollingStockName.innerText()).toEqual(
        fastRollingStockName
      );
    });

    await test.step('Update departure time and submit edit', async () => {
      await operationalStudiesPage.setTimetableItemStartTime('12:00');
      await operationalStudiesPage.submitTimetableItemEdit();
      await operationalStudiesPage.checkToastHasBeenLaunched(
        frTranslations.timetable.pacedTrainUpdated
      );
    });

    await test.step('Verify all occurrences (4 occurrences including 1 added exception )', async () => {
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name}/+`,
          startTime: '21:00',
          arrivalTime: '21:03',
          rollingStock: fastRollingStockName,
        },
        0
      );
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name} 1`,
          startTime: '12:00',
          arrivalTime: '12:07',
          rollingStock: slowRollingStockName,
        },
        1
      );
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name} 3`,
          startTime: '13:00',
          arrivalTime: '13:03',
          rollingStock: fastRollingStockName,
        },
        2
      );
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name} 5`,
          startTime: '14:00',
          arrivalTime: '14:03',
          rollingStock: fastRollingStockName,
        },
        3
      );
    });

    await test.step('Reset all exceptions', async () => {
      await pacedTrainSection.resetAllPacedTrainExceptions(5);
      await pacedTrainSection.clickOnPacedTrain(5);
    });

    await test.step('Verify occurrences after reset', async () => {
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name} 1`,
          startTime: '12:00',
          arrivalTime: '12:03',
          rollingStock: editedPacedTrainData.rolling_stock_name,
        },
        0
      );
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name} 3`,
          startTime: '13:00',
          arrivalTime: '13:03',
          rollingStock: editedPacedTrainData.rolling_stock_name,
        },
        1
      );
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name} 5`,
          startTime: '14:00',
          arrivalTime: '14:03',
          rollingStock: editedPacedTrainData.rolling_stock_name,
        },
        2
      );
    });

    await test.step('Check action buttons count after reset (4 buttons instead of 5)', async () => {
      await pacedTrainSection.getActionButtonsLocators({
        itemIndex: 5,
        itemType: 'paced-train',
        checkVisibility: true,
      });
    });
  });

  /** *************** Test 2 **************** */
  test('Modify a paced train and create added exception', async () => {
    const editedPacedTrainData = pacedTrainsJson[1];

    await test.step('Edit paced train at index 1', async () => {
      await pacedTrainSection.openPacedTrainEditor(1);
      await scenarioTimetableSection.verifyEditTimetableItemButtonVisibility();
    });

    await test.step('Check inputs before editing paced train', async () => {
      await operationalStudiesPage.checkInputsBeforeEditingAPacedTrain(
        frTranslations,
        editedPacedTrainData.paced.time_window,
        editedPacedTrainData.paced.interval
      );
    });

    await test.step('Add an exception for the paced train', async () => {
      await operationalStudiesPage.createPacedTrainException('2025-08-08', '12:00:00');
    });

    await test.step('Submit edit and verify the occurrences count (5)', async () => {
      await operationalStudiesPage.submitTimetableItemEdit();
      await pacedTrainSection.expectOccurrencesListLength(5);
      await operationalStudiesPage.checkToastHasBeenLaunched(
        frTranslations.timetable.pacedTrainUpdated
      );
    });

    await test.step('Verify details of the added exception occurrence (index 4)', async () => {
      await pacedTrainSection.verifyOccurrenceDetails(
        {
          name: `${editedPacedTrainData.train_name}/+`,
          startTime: '12:00',
          arrivalTime: '12:07',
        },
        4
      );
    });

    await test.step('Check tooltip and occurrence menu for added exception', async () => {
      await pacedTrainSection.checkExceptionTooltip(
        4,
        frTranslations.timetable.occurrenceType.addedOccurrence,
        frTranslations.timetable.occurrenceChangeGroup.start_time as ChangeGroup
      );

      await pacedTrainSection.checkOccurrenceMenuIcon(4);
      await pacedTrainSection.checkOccurrenceActionMenu({
        occurrenceIndex: 4,
        expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
        translations: frTranslations,
      });
    });
  });

  /** *************** Test 3 **************** */
  test('Edit an indexed occurrence', async () => {
    await test.step('Open paced train and check initial menu (first occurrence)', async () => {
      await pacedTrainSection.clickOnPacedTrain(0);
      await pacedTrainSection.checkOccurrenceMenuIcon(0);
      await pacedTrainSection.checkOccurrenceActionMenu({
        occurrenceIndex: 0,
        expectedButtons: CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
        translations: frTranslations,
      });
    });

    await test.step('Edit occurrence name and save', async () => {
      await pacedTrainSection.clickOccurrenceMenuButton('edit');
      await operationalStudiesPage.setTimetableItemName(EDITED_OCCURRENCE_NAME);
      await operationalStudiesPage.updateTimetableItem(frTranslations.pacedTrains.updatePacedTrain);
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

    await test.step('Disable edited occurrence and verify UI', async () => {
      await pacedTrainSection.clickOccurrenceMenuButton('disable');
      await pacedTrainSection.verifyOccurrenceName(0, EDITED_OCCURRENCE_NAME);
      await pacedTrainSection.checkOccurrenceMenuIcon(0);
      await pacedTrainSection.checkOccurrenceActionMenu({
        occurrenceIndex: 0,
        expectedButtons: DISABLED_OCCURRENCE_MENU_BUTTONS,
        translations: frTranslations,
      });
    });

    await test.step('Re-enable edited occurrence and verify UI', async () => {
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

  /** *************** Test 4 **************** */
  test('Edit added exception', async () => {
    const PACED_TRAIN_NUMBER = 4;
    const addedOccurrenceIndex = 1;
    const editedPacedTrainData = pacedTrainsJson[PACED_TRAIN_NUMBER];

    await test.step('Open paced train and check initial menu state', async () => {
      await pacedTrainSection.clickOnPacedTrain(PACED_TRAIN_NUMBER);
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

      await operationalStudiesPage.setTimetableItemStartTime('02:40', '2024-10-16');

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

      await pacedTrainSection.checkOccurrenceMenuIcon(addedOccurrenceIndex);
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
});
