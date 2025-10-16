import { expect } from '@playwright/test';

import type {
  ElectricalProfileSet,
  Infra,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import { improbableRollingStockName } from './assets/constants/project-const';
import test from './logging-fixture';
import OperationalStudiesPage from './pages/operational-studies/operational-studies-page';
import RouteTab from './pages/operational-studies/route-tab';
import ScenarioTimetableSection from './pages/operational-studies/scenario-timetable-section';
import OpSimulationResultPage from './pages/operational-studies/simulation-results-page';
import SimulationSettingsTab from './pages/operational-studies/simulation-settings-tab';
import TimeAndStopSimulationOutputs from './pages/operational-studies/time-stop-simulation-outputs';
import TimesAndStopsTab from './pages/operational-studies/times-and-stops-tab';
import RollingStockSelector from './pages/rolling-stock/rolling-stock-selector';
import { waitForInfraStateToBeCached } from './utils';
import { deleteApiRequest, getInfra, setElectricalProfile } from './utils/api-utils';
import { cleanWhitespace } from './utils/data-normalizer';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import scrollContainer from './utils/scroll-helper';
import { deleteScenario } from './utils/teardown-utils';
import type { FlatTranslations, StationData } from './utils/types';

const frTranslations = readJsonFile<Record<string, FlatTranslations>>(
  'public/locales/fr/translation.json'
).timeStopTable;

const expectedCellDataElectricalProfileON: StationData[] = readJsonFile(
  './tests/assets/operation-studies/simulation-settings/electrical-profiles/electrical-profile-on.json'
);
const expectedCellDataElectricalProfileOFF: StationData[] = readJsonFile(
  './tests/assets/operation-studies/simulation-settings/electrical-profiles/electrical-profile-off.json'
);

const expectedCellDataCodeCompoON: StationData[] = readJsonFile(
  './tests/assets/operation-studies/simulation-settings/speed-limit-tag/speed-limit-tag-on.json'
);
const expectedCellDataCodeCompoOFF: StationData[] = readJsonFile(
  './tests/assets/operation-studies/simulation-settings/speed-limit-tag/speed-limit-tag-off.json'
);

const expectedCellDataLinearMargin: StationData[] = readJsonFile(
  './tests/assets/operation-studies/simulation-settings/margin/linear-margin.json'
);
const expectedCellDataMarecoMargin: StationData[] = readJsonFile(
  './tests/assets/operation-studies/simulation-settings/margin/mareco-margin.json'
);
const expectedCellDataForAllSettings: StationData[] = readJsonFile(
  './tests/assets/operation-studies/simulation-settings/all-settings.json'
);

test.describe('Simulation Settings Tab Verification', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let operationalStudiesPage: OperationalStudiesPage;
  let rollingStockSelector: RollingStockSelector;
  let routeTab: RouteTab;
  let timesAndStopsTab: TimesAndStopsTab;
  let timeAndStopSimulationOutputs: TimeAndStopSimulationOutputs;
  let simulationSettingsTab: SimulationSettingsTab;
  let simulationResultPage: OpSimulationResultPage;
  let scenarioTimetableSection: ScenarioTimetableSection;

  let electricalProfileSet: ElectricalProfileSet;
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;

  type TranslationKeys = keyof typeof frTranslations;

  // Define CellData type for table cell data
  type CellData = {
    stationName: string;
    header: TranslationKeys;
    value: string;
    marginForm?: string;
  };

  test.beforeAll('Add electrical profile via API and fetch infrastructure', async () => {
    electricalProfileSet = await setElectricalProfile();
    infra = await getInfra();
  });

  test.afterAll('Delete the electrical profile', async () => {
    if (electricalProfileSet?.id)
      await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
  });

  test.beforeEach(async ({ page }) => {
    [
      operationalStudiesPage,
      routeTab,
      rollingStockSelector,
      timesAndStopsTab,
      timeAndStopSimulationOutputs,
      simulationSettingsTab,
      simulationResultPage,
      scenarioTimetableSection,
    ] = [
      new OperationalStudiesPage(page),
      new RouteTab(page),
      new RollingStockSelector(page),
      new TimesAndStopsTab(page),
      new TimeAndStopSimulationOutputs(page),
      new SimulationSettingsTab(page),
      new OpSimulationResultPage(page),
      new ScenarioTimetableSection(page),
    ];

    await test.step('Create then navigate to scenario page', async () => {
      ({ project, study, scenario } = await createScenario(
        undefined,
        null,
        null,
        null,
        electricalProfileSet.id
      ));
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await operationalStudiesPage.removeViteOverlay();
      await waitForInfraStateToBeCached(infra.id);
    });
    await test.step('Add a new train schedule, set its properties and perform pathfinding', async () => {
      await operationalStudiesPage.openTimetableItemForm();
      await operationalStudiesPage.setTimetableItemName('Train-name-e2e-test');
      await rollingStockSelector.selectRollingStock(improbableRollingStockName);
      await operationalStudiesPage.setTimetableItemStartTime('11:22:40');

      await operationalStudiesPage.openRouteTab();
      await routeTab.performPathfindingByTrigram({
        originTrigram: 'WS',
        destinationTrigram: 'SES',
        viaTrigram: 'MWS',
      });
      await operationalStudiesPage.openTimesAndStopsTab();
      await scrollContainer(page, '.time-stops-datasheet .dsg-container');
    });
  });

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test('Activate electrical profiles', async ({ page, browserName }) => {
    const cell: CellData = { stationName: 'Mid_East_station', header: 'stopTime', value: '124' };
    const translatedHeader = cleanWhitespace(frTranslations[cell.header]);

    await test.step('Fill Times & Stops input', async () => {
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value
      );
    });

    await test.step('Activate electrical profiles + Mareco margin', async () => {
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.checkElectricalProfile();
      await simulationSettingsTab.checkMarecoMargin();
    });

    await test.step('Create train schedule and verify (electrical profile ON)', async () => {
      await operationalStudiesPage.createTimetableItem();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await scenarioTimetableSection.getTimetableItemArrivalTime('11:48');
      await simulationResultPage.setTrainListVisible();

      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
      await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileActivated.png'
        );
      }
      await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
      await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataElectricalProfileON);
      await simulationResultPage.setTrainListVisible(false);
    });

    await test.step('Deactivate electrical profiles and verify (OFF)', async () => {
      await scenarioTimetableSection.editTimetableItem();
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.deactivateElectricalProfile();
      await operationalStudiesPage.submitTimetableItemEdit();
      await simulationResultPage.setTrainListVisible();

      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
      await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileDisabled.png'
        );
      }
      await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataElectricalProfileOFF);
      await simulationResultPage.setTrainListVisible(false);
      await scenarioTimetableSection.getTimetableItemArrivalTime('11:48');
    });
  });

  test('Add speed limit tag', async ({ page, browserName }) => {
    const cell: CellData = { stationName: 'Mid_East_station', header: 'stopTime', value: '124' };
    const translatedHeader = cleanWhitespace(frTranslations[cell.header]);

    await test.step('Fill Times & Stops input', async () => {
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value
      );
    });

    await test.step('Enable Mareco margin + speed limit tag (HLP), disable electrical profile', async () => {
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.deactivateElectricalProfile();
      await simulationSettingsTab.checkMarecoMargin();
      await simulationSettingsTab.selectSpeedLimitTagOption('E32C');
    });

    await test.step('Create train schedule and verify (speed limit tag ON)', async () => {
      await operationalStudiesPage.createTimetableItem();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await scenarioTimetableSection.getTimetableItemArrivalTime('11:49');
      await simulationResultPage.setTrainListVisible();

      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
      await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagActivated.png'
        );
      }
      await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
      await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataCodeCompoON);
      await simulationResultPage.setTrainListVisible(false);
    });

    await test.step('Remove speed limit tag and verify (speed limit tag OFF)', async () => {
      await scenarioTimetableSection.editTimetableItem();
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.selectSpeedLimitTagOption('__PLACEHOLDER__');
      await operationalStudiesPage.submitTimetableItemEdit();
      await simulationResultPage.setTrainListVisible();

      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
      await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagDisabled.png'
        );
      }
      await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataCodeCompoOFF);
      await simulationResultPage.setTrainListVisible(false);
      await scenarioTimetableSection.getTimetableItemArrivalTime('11:48');
    });
  });

  test('Activate linear and mareco margin', async ({ page, browserName }) => {
    const inputTableData: CellData[] = [
      { stationName: 'Mid_East_station', header: 'stopTime', value: '124' },
      {
        stationName: 'West_station',
        header: 'theoreticalMargin',
        value: '10%',
        marginForm: '% ou min/100km',
      },
    ];

    await test.step('Fill Times & Stops inputs (stop time + theoretical margin)', async () => {
      for (const cell of inputTableData) {
        const translatedHeader = cleanWhitespace(frTranslations[cell.header]);
        await timesAndStopsTab.fillTableCellByStationAndHeader(
          cell.stationName,
          translatedHeader,
          cell.value,
          cell.marginForm
        );
      }
    });

    await test.step('Enable Linear margin (electrical OFF)', async () => {
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.deactivateElectricalProfile();
      await simulationSettingsTab.activateLinearMargin();
    });

    await test.step('Create train schedule and verify (Linear)', async () => {
      await operationalStudiesPage.createTimetableItem();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await scenarioTimetableSection.getTimetableItemArrivalTime('11:51');
      await simulationResultPage.setTrainListVisible();

      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
      await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-LinearMargin.png'
        );
      }
      await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
      await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataLinearMargin);
      await simulationResultPage.setTrainListVisible(false);
    });

    await test.step('Edit to Mareco margin and verify', async () => {
      await scenarioTimetableSection.editTimetableItem();
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.activateMarecoMargin();
      await operationalStudiesPage.submitTimetableItemEdit();
      await simulationResultPage.setTrainListVisible();

      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
      await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-MarecoMargin.png'
        );
      }
      await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataMarecoMargin);
      await simulationResultPage.setTrainListVisible(false);
      await scenarioTimetableSection.getTimetableItemArrivalTime('11:51');
    });
  });

  test('Add all the simulation settings', async ({ page, browserName }) => {
    const inputTableData: CellData[] = [
      { stationName: 'Mid_East_station', header: 'stopTime', value: '124' },
      {
        stationName: 'West_station',
        header: 'theoreticalMargin',
        value: '5%',
        marginForm: '% ou min/100km',
      },
    ];

    await test.step('Fill Times & Stops inputs', async () => {
      for (const cell of inputTableData) {
        const translatedHeader = cleanWhitespace(frTranslations[cell.header]);
        await timesAndStopsTab.fillTableCellByStationAndHeader(
          cell.stationName,
          translatedHeader,
          cell.value,
          cell.marginForm
        );
      }
    });

    await test.step('Enable Linear margin + electrical profile + speed limit tag', async () => {
      await operationalStudiesPage.openSimulationSettingsTab();
      await simulationSettingsTab.checkElectricalProfile();
      await simulationSettingsTab.activateLinearMargin();
      await simulationSettingsTab.selectSpeedLimitTagOption('E32C');
    });

    await test.step('Create train schedule and verify outputs (all settings ON)', async () => {
      await operationalStudiesPage.createTimetableItem();
      await operationalStudiesPage.closeToastNotification();
      await operationalStudiesPage.returnSimulationResult();
      await simulationResultPage.setTrainListVisible();

      await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
      await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
      if (browserName === 'chromium') {
        await expect(simulationResultPage.speedSpaceChart).toHaveScreenshot(
          'SpeedSpaceChart-AllSettingsEnabled.png'
        );
      }
      await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
      await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataForAllSettings);
      await simulationResultPage.setTrainListVisible(false);
      await scenarioTimetableSection.getTimetableItemArrivalTime('11:50');
    });
  });
});
