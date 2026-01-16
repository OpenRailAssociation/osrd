import { expect } from '@playwright/test';

import type {
  Scenario,
  Project,
  Study,
  Infra,
  TrainSchedule,
  PacedTrain,
} from 'common/api/osrdEditoastApi';

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
import { generateUniqueName, waitForInfraStateToBeCached } from '../../utils';
import { getInfra, getProject, getStudy } from '../../utils/api-utils';
import readJsonFile from '../../utils/file-utils';
import {
  expectedWaypointsListDataForTrainSchedule,
  expectedWaypointsListDataForPacedTrain,
  expectedWaypointsPanelDataForTrainSchedule,
  expectedWaypointsPanelDataForPacedTrain,
  verifyWaypointsData,
} from '../../utils/manchette';
import createScenario from '../../utils/scenario';
import sendTrains from '../../utils/send-trains';
import { deleteScenario } from '../../utils/teardown-utils';
import type {
  CommonTranslations,
  ManageTimetableItemTranslations,
  TimetableFilterTranslations,
} from '../../utils/types';

const frManageTimetableItemTranslations: ManageTimetableItemTranslations = readJsonFile<{
  manageTimetableItem: ManageTimetableItemTranslations;
}>('public/locales/fr/operational-studies.json').manageTimetableItem;

const frScenarioTranslations: TimetableFilterTranslations = readJsonFile<{
  main: TimetableFilterTranslations;
}>('public/locales/fr/operational-studies.json').main;

const frCommonTranslations: CommonTranslations = readJsonFile('public/locales/fr/translation.json');
const frTranslations = {
  ...frManageTimetableItemTranslations,
  ...frScenarioTranslations,
  ...frCommonTranslations,
};

const trainSchedulesJson = readJsonFile<TrainSchedule[]>(
  './tests/assets/train-schedule/train_schedules.json'
);
const pacedTrainsJson = readJsonFile<PacedTrain[]>('./tests/assets/paced-train/paced_trains.json');

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
    await sendTrains(trainScheduleSet.id, trainSchedulesJson.slice(20, 21));
    await sendTrains(trainScheduleSet.id, pacedTrainsJson.slice(6, 7));
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
    await test.step('Verify first train schedule is selected', async () => {
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
  });

  /** *************** Test 2 **************** */
  test.skip('Space time diagram (temporarily skipped until STD snapshots are stable)', async ({
    scenarioTimetableSection,
    opSimulationResultPage,
    getManchetteComponent,
    pacedTrainSection,
  }) => {
    await test.step('Project train schedule and capture GET screenshot', async () => {
      await scenarioTimetableSection.projectTrain();
      await getManchetteComponent.selectAllSpaceTimeChartCheckboxes();
      await getManchetteComponent.setRangeSliderValue('60'); // Adjust slider to show the full projection
      await opSimulationResultPage.setTrainListVisible();
      await expect(opSimulationResultPage.manchetteSpaceTimeChart).toHaveScreenshot(
        'TrainSchedule-Space-Time-Chart.png'
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
    await test.step('Project train schedule and verify waypoints list', async () => {
      await scenarioTimetableSection.projectTrain();
      await opSimulationResultPage.setTrainListVisible();
      const actualWaypointsListData = await getManchetteComponent.getWaypointsListData(4);
      verifyWaypointsData(actualWaypointsListData, expectedWaypointsListDataForTrainSchedule);
    });

    await test.step('Open panel and verify waypoints panel data', async () => {
      await getManchetteComponent.openManchettePanel();
      const actualWaypointsPanelData = await getManchetteComponent.getWaypointsPanelData();
      verifyWaypointsData(actualWaypointsPanelData, expectedWaypointsPanelDataForTrainSchedule);
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
