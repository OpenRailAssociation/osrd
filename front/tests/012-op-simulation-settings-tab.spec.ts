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
import { getTranslations, waitForInfraStateToBeCached } from './utils';
import { deleteApiRequest, getInfra, setElectricalProfile } from './utils/api-utils';
import { cleanWhitespace } from './utils/data-normalizer';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import scrollContainer from './utils/scroll-helper';
import { deleteScenario } from './utils/teardown-utils';
import type { FlatTranslations, StationData } from './utils/types';

const enTranslations: FlatTranslations = readJsonFile('public/locales/en/timesStops.json');
const frTranslations: FlatTranslations = readJsonFile('public/locales/fr/timesStops.json');

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
  let translations: typeof enTranslations | typeof frTranslations;

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

  type TranslationKeys = keyof typeof enTranslations;

  // Define CellData interface for table cell data
  interface CellData {
    stationName: string;
    header: TranslationKeys;
    value: string;
    marginForm?: string;
  }

  test.beforeAll('Add electrical profile via API and fetch infrastructure', async () => {
    electricalProfileSet = await setElectricalProfile();
    infra = await getInfra();
    translations = getTranslations({
      en: enTranslations,
      fr: frTranslations,
    });
  });

  test.afterAll('Delete the electrical profile', async () => {
    if (electricalProfileSet?.id)
      await deleteApiRequest(`/api/electrical_profile_set/${electricalProfileSet.id}/`);
  });

  test.beforeEach(
    'Navigate to Times and Stops tab with rolling stock and route set',
    async ({ page }) => {
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
      // Create a new scenario
      ({ project, study, scenario } = await createScenario(
        undefined,
        null,
        null,
        null,
        electricalProfileSet.id
      ));

      // Navigate to the created scenario page
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );
      await operationalStudiesPage.removeViteOverlay();
      // Wait for infra to be in 'CACHED' state before proceeding
      await waitForInfraStateToBeCached(infra.id);
      // Add a new train and set its properties
      await operationalStudiesPage.clickOnAddTrainButton();
      await operationalStudiesPage.setTrainScheduleName('Train-name-e2e-test');
      await rollingStockSelector.selectRollingStock(improbableRollingStockName);
      await operationalStudiesPage.setTrainStartTime('11:22:40');

      // Perform pathfinding
      await operationalStudiesPage.clickOnRouteTab();
      await routeTab.performPathfindingByTrigram('WS', 'SES', 'MWS');
      // Navigate to the Times and Stops tab and fill in required data
      await operationalStudiesPage.clickOnTimesAndStopsTab();
      await scrollContainer(page, '.time-stops-datasheet .dsg-container');
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test('Activate electrical profiles', async ({ page }) => {
    const cell: CellData = {
      stationName: 'Mid_East_station',
      header: 'stopTime',
      value: '124',
    };

    const translatedHeader = cleanWhitespace(translations[cell.header]);

    await timesAndStopsTab.fillTableCellByStationAndHeader(
      cell.stationName,
      translatedHeader,
      cell.value
    );
    // Activate electrical profiles
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await simulationSettingsTab.checkElectricalProfile();
    await simulationSettingsTab.checkMarecoMargin();
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await scenarioTimetableSection.getTrainArrivalTime('11:53');
    await scenarioTimetableSection.clickOnScenarioCollapseButton();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
    await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-ElectricalProfileActivated.png'
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataElectricalProfileON);
    await scenarioTimetableSection.clickOnTimetableCollapseButton();
    // Deactivate electrical profiles and verify output results
    await scenarioTimetableSection.clickOnEditTrain();
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await simulationSettingsTab.deactivateElectricalProfile();
    await scenarioTimetableSection.clickOnEditTrainSchedule();
    await scenarioTimetableSection.getTrainArrivalTime('11:52');
    await scenarioTimetableSection.clickOnScenarioCollapseButton();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
    await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-ElectricalProfileDisabled.png'
    );
    await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataElectricalProfileOFF);
  });
  test('Activate composition code', async ({ page }) => {
    const cell: CellData = {
      stationName: 'Mid_East_station',
      header: 'stopTime',
      value: '124',
    };
    const translatedHeader = cleanWhitespace(translations[cell.header]);

    await timesAndStopsTab.fillTableCellByStationAndHeader(
      cell.stationName,
      translatedHeader,
      cell.value
    );
    // Select a specific composition code option
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await simulationSettingsTab.deactivateElectricalProfile();
    await simulationSettingsTab.checkMarecoMargin();
    await simulationSettingsTab.selectCodeCompoOption('HLP');
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await scenarioTimetableSection.getTrainArrivalTime('12:03');
    await scenarioTimetableSection.clickOnScenarioCollapseButton();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
    await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-SpeedLimitTagActivated.png'
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataCodeCompoON);
    await scenarioTimetableSection.clickOnTimetableCollapseButton();
    // Remove the composition code option and verify the changes
    await scenarioTimetableSection.clickOnEditTrain();
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await simulationSettingsTab.selectCodeCompoOption('__PLACEHOLDER__');
    await scenarioTimetableSection.clickOnEditTrainSchedule();
    await scenarioTimetableSection.getTrainArrivalTime('11:52');
    await scenarioTimetableSection.clickOnScenarioCollapseButton();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
    await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-SpeedLimitTagDisabled.png'
    );
    await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataCodeCompoOFF);
  });
  test('Activate linear and mareco margin', async ({ page }) => {
    const inputTableData: CellData[] = [
      {
        stationName: 'Mid_East_station',
        header: 'stopTime',
        value: '124',
      },
      {
        stationName: 'West_station',
        header: 'theoreticalMargin',
        value: '10%',
        marginForm: '% ou min/100km',
      },
    ];
    for (const cell of inputTableData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,

        cell.marginForm
      );
    }
    // Activate the 'Linear' margin
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await simulationSettingsTab.deactivateElectricalProfile();
    await simulationSettingsTab.activateLinearMargin();
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await scenarioTimetableSection.getTrainArrivalTime('11:55');
    await scenarioTimetableSection.clickOnScenarioCollapseButton();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
    await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-LinearMargin.png'
    );

    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataLinearMargin);
    await scenarioTimetableSection.clickOnTimetableCollapseButton();
    // Modify the margin to 'Mareco' and verify the changes
    await scenarioTimetableSection.clickOnEditTrain();
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await simulationSettingsTab.activateMarecoMargin();
    await scenarioTimetableSection.clickOnEditTrainSchedule();
    await scenarioTimetableSection.getTrainArrivalTime('11:55');
    await scenarioTimetableSection.clickOnScenarioCollapseButton();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
    await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-MarecoMargin.png'
    );
    await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataMarecoMargin);
  });
  test('Add all the simulation settings', async ({ page }) => {
    const inputTableData: CellData[] = [
      {
        stationName: 'Mid_East_station',
        header: 'stopTime',
        value: '124',
      },
      {
        stationName: 'West_station',
        header: 'theoreticalMargin',
        value: '5%',
        marginForm: '% ou min/100km',
      },
    ];
    for (const cell of inputTableData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await timesAndStopsTab.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,

        cell.marginForm
      );
    }
    // Activate the 'Linear' margin, electrical profile and composition code
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await simulationSettingsTab.checkElectricalProfile();
    await simulationSettingsTab.activateLinearMargin();
    await simulationSettingsTab.selectCodeCompoOption('HLP');
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await scenarioTimetableSection.getTrainArrivalTime('12:06');
    await scenarioTimetableSection.clickOnScenarioCollapseButton();
    await timeAndStopSimulationOutputs.verifyTimesStopsDataSheetVisibility();
    await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
    await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
      'SpeedSpaceChart-AllSettingsEnabled.png'
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await timeAndStopSimulationOutputs.getOutputTableData(expectedCellDataForAllSettings);
  });
});
