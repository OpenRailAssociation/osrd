import { expect } from '@playwright/test';

import type { Scenario, Project, Study, Infra, TrainSchedule } from 'common/api/osrdEditoastApi';

import {
  timetableItemProjectName,
  timetableItemStudyName,
} from '../../assets/constants/project-const';
import {
  ADDED_EXCEPTION_MENU_BUTTONS,
  CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
  EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
} from '../../assets/paced-train/const';
import test from '../../page-object-fixture';
import {
  expectedWaypointsListDataForPacedTrain,
  expectedWaypointsListDataForUniqueTrain,
  expectedWaypointsPanelDataForPacedTrain,
  expectedWaypointsPanelDataForUniqueTrain,
  STD_MANCHETTE,
  WAYPOINT_CHECKBOX_STATE,
} from '../../pages/operational-studies/std-manchette';
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import { readJsonFile } from '../../utils/file-utils';
import { verifyWaypointsData } from '../../utils/manchette';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type {
  CommonTranslations,
  ManageTimetableItemTranslations,
  TimetableFilterTranslations,
  SimulationResultsTranslations,
} from '../../utils/types';

const frManageTimetableItemTranslations: ManageTimetableItemTranslations = readJsonFile<{
  manageTimetableItem: ManageTimetableItemTranslations;
}>('public/locales/fr/operational-studies.json').manageTimetableItem;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frSimulationResultTranslations: SimulationResultsTranslations = readJsonFile<{
  simulationResults: SimulationResultsTranslations;
}>('public/locales/fr/operational-studies.json').simulationResults;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frManageTimetableItemTranslations,
  ...frScenarioTranslations,
  ...frSimulationResultTranslations,
  ...frCommonTranslations,
};

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Limit to Chromium for GitHub snapshots storage optimization'
);

test.describe('@op @manchette @std', () => {
  let project: Project;
  let study: Study;
  let scenarioItems: Scenario;
  let infra: Infra;

  test.beforeAll('Fetch project, study and infrastructure', async () => {
    project = await getProject(timetableItemProjectName);
    study = await getStudy(project.id, timetableItemStudyName);
    infra = await getInfra();
    const { scenario, trainScheduleSet } = await createScenario(
      generateUniqueName('std-manchette-scenario'),
      project.id,
      study.id,
      infra.id
    );
    scenarioItems = scenario;

    const selectedTrains = [...trains.slice(6, 7), ...trains.slice(27, 28)];
    await sendTrains(trainScheduleSet.id, selectedTrains);
  });

  test.beforeEach('Open scenario and wait for infra to be loaded', async ({ page }) => {
    await page.goto(
      `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenarioItems.id}`
    );
    await waitForInfraStateToBeCached(infra.id);
  });

  test.afterAll('Delete the created scenario', async () => {
    await deleteScenario(study.id, scenarioItems.name);
  });

  /** *************** Test 1 **************** */
  test('@smoke Basic checks for STD/Manchette', async ({
    scenarioTimetableSection,
    opSimulationResultPage,
    getManchetteComponent,
  }) => {
    await test.step('Verify first unique train is selected', async () => {
      await scenarioTimetableSection.verifyFirstTimetableItemIsSelected();
      await opSimulationResultPage.setTrainListVisible();
    });
    await test.step('Assert GET slider', async () => {
      await getManchetteComponent.assertDefaultSliderValue();
    });

    await test.step('Toggle linear km mode', async () => {
      await getManchetteComponent.toggleLinearKmMode();
    });

    await test.step('Expand and collapse warped map', async () => {
      await getManchetteComponent.expandWarpedMap();
      await getManchetteComponent.collapseWarpedMap();
    });

    await test.step('Zoom controls on GET', async () => {
      await getManchetteComponent.adjustAndResetGetZoom();
    });

    await test.step('Zoom controls on Manchette', async () => {
      await getManchetteComponent.zoomInAndResetManchette();
    });

    await test.step('Tracks occupancy panel can open/close', async () => {
      await getManchetteComponent.openTrackOccupancyPanel(
        STD_MANCHETTE.occupancyWaypointIndex,
        frTranslations
      );
      await getManchetteComponent.closeTrackOccupancyPanel(
        STD_MANCHETTE.occupancyWaypointIndex,
        frTranslations
      );
    });

    await test.step('Show and hide waypoints', async () => {
      await getManchetteComponent.verifyVisibleWaypointsCount(
        STD_MANCHETTE.initialVisibleWaypoints
      );
      await getManchetteComponent.hideWaypoint(STD_MANCHETTE.normalWaypointIndex);
      // After hiding the normal waypoint the requested point is displayed instead
      await getManchetteComponent.verifyVisibleWaypointsCount(
        STD_MANCHETTE.initialVisibleWaypoints
      );
      await getManchetteComponent.hideWaypoint(STD_MANCHETTE.requestedWaypointIndex, true);
      await getManchetteComponent.verifyVisibleWaypointsCount(
        STD_MANCHETTE.visibleAfterHidingRequested
      );
      await getManchetteComponent.openManchettePanel();
      await getManchetteComponent.verifyWaypointsCheckedState(
        WAYPOINT_CHECKBOX_STATE.checked,
        WAYPOINT_CHECKBOX_STATE.total
      );
      await getManchetteComponent.closeWaypointPanel();
    });
  });

  /** *************** Test 2 **************** */
  test.skip('Space time diagram (temporarily skipped until STD snapshots are stable)', async ({
    scenarioTimetableSection,
    opSimulationResultPage,
    getManchetteComponent,
    pacedTrainSection,
  }) => {
    await test.step('Project unique train and capture GET screenshot', async () => {
      await scenarioTimetableSection.projectTrain();
      await getManchetteComponent.selectAllSpaceTimeChartCheckboxes();
      await getManchetteComponent.setRangeSliderValue('60'); // Adjust slider to show the full projection
      await opSimulationResultPage.setTrainListVisible();
      await expect(opSimulationResultPage.manchetteSpaceTimeChart).toHaveScreenshot(
        'UniqueTrain-Space-Time-Chart.png'
      );
    });

    await test.step('Project paced train and capture GET screenshot', async () => {
      await opSimulationResultPage.setTrainListVisible(false);
      await pacedTrainSection.projectPacedTrain();
      await getManchetteComponent.setRangeSliderValue('50'); // Adjust slider to show the paced train better
      await opSimulationResultPage.setTrainListVisible();
      await expect(opSimulationResultPage.manchetteSpaceTimeChart).toHaveScreenshot(
        'PacedTrain-Space-Time-Chart.png'
      );
    });

    await test.step('Project first occurrence (conform) and capture screenshot', async () => {
      await opSimulationResultPage.setTrainListVisible(false);
      await getManchetteComponent.setRangeSliderValue('60'); // Reset slider to show the full diagram
      await pacedTrainSection.clickOnOccurrence(0);
      await pacedTrainSection.checkOccurrenceMenuIcon(0);
      await pacedTrainSection.checkOccurrenceActionMenu({
        occurrenceIndex: 0,
        expectedButtons: CONFORM_ACTIVE_OCCURRENCE_MENU_BUTTONS,
        translations: frTranslations,
      });

      await pacedTrainSection.clickOccurrenceMenuButton('project');
      await opSimulationResultPage.setTrainListVisible();
      await expect(opSimulationResultPage.manchetteSpaceTimeChart).toHaveScreenshot(
        'ConformOccurrence-Space-Time-Chart.png'
      );
    });

    await test.step('Project added exception and capture screenshot', async () => {
      await opSimulationResultPage.setTrainListVisible(false);
      await pacedTrainSection.clickOnOccurrence(3);
      await pacedTrainSection.checkOccurrenceMenuIcon(3);
      await pacedTrainSection.checkOccurrenceActionMenu({
        occurrenceIndex: 3,
        expectedButtons: ADDED_EXCEPTION_MENU_BUTTONS,
        translations: frTranslations,
      });

      await pacedTrainSection.clickOccurrenceMenuButton('project');
      await opSimulationResultPage.setTrainListVisible();
      await expect(opSimulationResultPage.manchetteSpaceTimeChart).toHaveScreenshot(
        'AddedOccurrence-Space-Time-Chart.png'
      );
    });

    await test.step('Project last occurrence (exception) and capture screenshot', async () => {
      await opSimulationResultPage.setTrainListVisible(false);
      await pacedTrainSection.clickOnOccurrence(4);
      await pacedTrainSection.checkOccurrenceMenuIcon(4);
      await pacedTrainSection.checkOccurrenceActionMenu({
        occurrenceIndex: 4,
        expectedButtons: EXCEPTION_ACTIVE_OCCURRENCE_MENU_BUTTONS,
        translations: frTranslations,
      });
      await pacedTrainSection.clickOccurrenceMenuButton('project');
      await opSimulationResultPage.setTrainListVisible();
      await expect(opSimulationResultPage.manchetteSpaceTimeChart).toHaveScreenshot(
        'ModifiedOccurrence-Space-Time-Chart.png'
      );
    });
  });

  /** *************** Test 3 **************** */
  test('Manchette waypoints data', async ({
    scenarioTimetableSection,
    opSimulationResultPage,
    getManchetteComponent,
    pacedTrainSection,
  }) => {
    await test.step('Project unique train and verify waypoints list', async () => {
      await scenarioTimetableSection.projectTrain();
      await opSimulationResultPage.setTrainListVisible();
      const actualWaypointsListData = await getManchetteComponent.getWaypointsListData(4);
      verifyWaypointsData(actualWaypointsListData, expectedWaypointsListDataForUniqueTrain);
    });

    await test.step('Open panel and verify waypoints panel data', async () => {
      await getManchetteComponent.openManchettePanel();
      const actualWaypointsPanelData = await getManchetteComponent.getWaypointsPanelData();
      verifyWaypointsData(actualWaypointsPanelData, expectedWaypointsPanelDataForUniqueTrain);
      await getManchetteComponent.closeWaypointPanel();
    });

    await test.step('Project paced train and verify waypoints list', async () => {
      await opSimulationResultPage.setTrainListVisible(false);
      await pacedTrainSection.projectPacedTrain();
      await opSimulationResultPage.setTrainListVisible();
      const actualWaypointsListData = await getManchetteComponent.getWaypointsListData(4);
      verifyWaypointsData(actualWaypointsListData, expectedWaypointsListDataForPacedTrain);
    });

    await test.step('Open panel and verify waypoints panel data', async () => {
      await getManchetteComponent.openManchettePanel();
      const actualWaypointsPanelData = await getManchetteComponent.getWaypointsPanelData();
      verifyWaypointsData(actualWaypointsPanelData, expectedWaypointsPanelDataForPacedTrain);
      await getManchetteComponent.closeWaypointPanel();
    });
  });
});
