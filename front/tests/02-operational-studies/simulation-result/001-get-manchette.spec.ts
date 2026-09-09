import { expect } from '@playwright/test';

import type { TrainSchedule } from 'common/api/osrdEditoastApi';

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
import setupScenarioFixture from '../../scenario-fixture';
import { readJsonFile } from '../../utils/file-utils';
import { verifyWaypointsData } from '../../utils/manchette';
import type {
  CommonTranslations,
  ManageTrainScheduleTranslations,
  TimetableFilterTranslations,
  SimulationResultsTranslations,
} from '../../utils/types';

const frManageTrainScheduleTranslations: ManageTrainScheduleTranslations = readJsonFile<{
  manageTrainSchedule: ManageTrainScheduleTranslations;
}>('public/locales/fr/operational-studies.json').manageTrainSchedule;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frSimulationResultTranslations: SimulationResultsTranslations = readJsonFile<{
  simulationResults: SimulationResultsTranslations;
}>('public/locales/fr/operational-studies.json').simulationResults;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frManageTrainScheduleTranslations,
  ...frScenarioTranslations,
  ...frSimulationResultTranslations,
  ...frCommonTranslations,
};

const trains: TrainSchedule[] = readJsonFile('./tests/assets/trains/trains.json');

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Limit to Chromium for GitHub snapshots storage optimization'
);

test.describe('Space Time Diagram / Manchette', { tag: ['@op', '@manchette', '@std'] }, () => {
  setupScenarioFixture({
    scenarioNamePrefix: 'std-manchette-scenario',
    trains: [...trains.slice(6, 7), ...trains.slice(27, 28)],
  });

  /** *************** Test 1 **************** */
  test(
    'Basic checks for Space Time Diagram / Manchette',
    { tag: '@smoke' },
    async ({ scenarioTimetableSection, opSimulationResultPage, getManchetteComponent }) => {
      await test.step('Verify first unique train is selected', async () => {
        await scenarioTimetableSection.verifyFirstTrainScheduleIsSelected();
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
        await getManchetteComponent.hideWaypoint(STD_MANCHETTE.firstHiddenWaypointIndex);
        await getManchetteComponent.verifyVisibleWaypointsCount(
          STD_MANCHETTE.visibleAfterHidingFirstWaypoint
        );
        await getManchetteComponent.hideWaypoint(STD_MANCHETTE.secondHiddenWaypointIndex, false);
        await getManchetteComponent.verifyVisibleWaypointsCount(
          STD_MANCHETTE.visibleAfterHidingSecondWaypoint
        );
        await getManchetteComponent.openManchettePanel();
        await getManchetteComponent.verifyWaypointsCheckedState(
          WAYPOINT_CHECKBOX_STATE.checked,
          WAYPOINT_CHECKBOX_STATE.total
        );
        await getManchetteComponent.closeWaypointPanel();
      });
    }
  );

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
