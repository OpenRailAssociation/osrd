import { expect } from '@playwright/test';

import type {
  ElectricalProfileSet,
  Infra,
  Project,
  Scenario,
  Study,
} from 'common/api/osrdEditoastApi';

import { improbableRollingStockName } from './assets/project-const';
import test from './logging-fixture';
import OperationalStudiesInputTablePage from './pages/op-input-table-page-model';
import OperationalStudiesOutputTablePage from './pages/op-output-table-page-model';
import RoutePage from './pages/op-route-page-model';
import OpSimulationResultPage from './pages/op-simulation-results-page-model';
import OperationalStudiesSimulationSettingsPage from './pages/op-simulation-settings-page-model';
import OperationalStudiesTimetablePage from './pages/op-timetable-page-model';
import OperationalStudiesPage from './pages/operational-studies-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page-model';
import {
  getTranslations,
  performOnSpecificOSAndBrowser,
  waitForInfraStateToBeCached,
} from './utils';
import { deleteApiRequest, getInfra, setElectricalProfile } from './utils/api-setup';
import { cleanWhitespace } from './utils/dataNormalizer';
import readJsonFile from './utils/file-utils';
import createScenario from './utils/scenario';
import scrollContainer from './utils/scrollHelper';
import { deleteScenario } from './utils/teardown-utils';
import type { FlatTranslations, StationData } from './utils/types';

const enTranslations: FlatTranslations = readJsonFile('public/locales/en/timesStops.json');
const frTranslations: FlatTranslations = readJsonFile('public/locales/fr/timesStops.json');

test.describe('Simulation Settings Tab Verification', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let operationalStudiesPage: OperationalStudiesPage;
  let rollingStockPage: RollingStockSelectorPage;
  let routePage: RoutePage;
  let opInputTablePage: OperationalStudiesInputTablePage;
  let opOutputTablePage: OperationalStudiesOutputTablePage;
  let opSimulationSettingsPage: OperationalStudiesSimulationSettingsPage;
  let simulationResultPage: OpSimulationResultPage;
  let opTimetablePage: OperationalStudiesTimetablePage;
  let electricalProfileSet: ElectricalProfileSet;
  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let infra: Infra;
  let translations: typeof enTranslations | typeof frTranslations;

  const expectedCellDataElectricalProfileON: StationData[] = readJsonFile(
    './tests/assets/operationStudies/simulationSettings/electricalProfiles/electricalProfileON.json'
  );
  const expectedCellDataElectricalProfileOFF: StationData[] = readJsonFile(
    './tests/assets/operationStudies/simulationSettings/electricalProfiles/electricalProfileOFF.json'
  );

  const expectedCellDataCodeCompoON: StationData[] = readJsonFile(
    './tests/assets/operationStudies/simulationSettings/codeCompo/codeCompoON.json'
  );
  const expectedCellDataCodeCompoOFF: StationData[] = readJsonFile(
    './tests/assets/operationStudies/simulationSettings/codeCompo/codeCompoOFF.json'
  );

  const expectedCellDataLinearMargin: StationData[] = readJsonFile(
    './tests/assets/operationStudies/simulationSettings/margin/linearMargin.json'
  );
  const expectedCellDataMarecoMargin: StationData[] = readJsonFile(
    './tests/assets/operationStudies/simulationSettings/margin/marecoMargin.json'
  );
  const expectedCellDataForAllSettings: StationData[] = readJsonFile(
    './tests/assets/operationStudies/simulationSettings/allSettings.json'
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
        routePage,
        rollingStockPage,
        opInputTablePage,
        opOutputTablePage,
        opSimulationSettingsPage,
        simulationResultPage,
        opTimetablePage,
      ] = [
        new OperationalStudiesPage(page),
        new RoutePage(page),
        new RollingStockSelectorPage(page),
        new OperationalStudiesInputTablePage(page),
        new OperationalStudiesOutputTablePage(page),
        new OperationalStudiesSimulationSettingsPage(page),
        new OpSimulationResultPage(page),
        new OperationalStudiesTimetablePage(page),
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
      await rollingStockPage.selectRollingStock(improbableRollingStockName);
      await operationalStudiesPage.setTrainStartTime('11:22:40');

      // Perform pathfinding
      await operationalStudiesPage.clickOnRouteTab();
      await routePage.performPathfindingByTrigram('WS', 'SES', 'MWS');
      // Navigate to the Times and Stops tab and fill in required data
      await operationalStudiesPage.clickOnTimesAndStopsTab();
      await scrollContainer(page, '.time-stops-datasheet .dsg-container');
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test('Activate electrical profiles', async ({ page, browserName }) => {
    const cell: CellData = {
      stationName: 'Mid_East_station',
      header: 'stopTime',
      value: '124',
    };

    const translatedHeader = cleanWhitespace(translations[cell.header]);

    await opInputTablePage.fillTableCellByStationAndHeader(
      cell.stationName,
      translatedHeader,
      cell.value
    );
    // Activate electrical profiles
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await opSimulationSettingsPage.checkElectricalProfile();
    await opSimulationSettingsPage.checkMarecoMargin();
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await opTimetablePage.getTrainArrivalTime('11:53');
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opOutputTablePage.verifyTimesStopsDataSheetVisibility();
    await performOnSpecificOSAndBrowser(
      async () => {
        await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileActivated.png'
        );
      },
      {
        currentBrowser: browserName,
        actionName: 'visual assertion',
      }
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await opOutputTablePage.getOutputTableData(expectedCellDataElectricalProfileON);
    await opTimetablePage.clickOnTimetableCollapseButton();
    // Deactivate electrical profiles and verify output results
    await opTimetablePage.clickOnEditTrain();
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await opSimulationSettingsPage.deactivateElectricalProfile();
    await opTimetablePage.clickOnEditTrainSchedule();
    await opTimetablePage.getTrainArrivalTime('11:52');
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opOutputTablePage.verifyTimesStopsDataSheetVisibility();
    await performOnSpecificOSAndBrowser(
      async () => {
        await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
          'SpeedSpaceChart-ElectricalProfileDisabled.png'
        );
      },
      {
        currentBrowser: browserName,
        actionName: 'visual assertion',
      }
    );
    await opOutputTablePage.getOutputTableData(expectedCellDataElectricalProfileOFF);
  });
  test('Activate composition code', async ({ page, browserName }) => {
    const cell: CellData = {
      stationName: 'Mid_East_station',
      header: 'stopTime',
      value: '124',
    };
    const translatedHeader = cleanWhitespace(translations[cell.header]);

    await opInputTablePage.fillTableCellByStationAndHeader(
      cell.stationName,
      translatedHeader,
      cell.value
    );
    // Select a specific composition code option
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await opSimulationSettingsPage.deactivateElectricalProfile();
    await opSimulationSettingsPage.checkMarecoMargin();
    await opSimulationSettingsPage.selectCodeCompoOption('HLP');
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await opTimetablePage.getTrainArrivalTime('12:03');
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opOutputTablePage.verifyTimesStopsDataSheetVisibility();
    await performOnSpecificOSAndBrowser(
      async () => {
        await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagActivated.png'
        );
      },
      {
        currentBrowser: browserName,
        actionName: 'visual assertion',
      }
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await opOutputTablePage.getOutputTableData(expectedCellDataCodeCompoON);
    await opTimetablePage.clickOnTimetableCollapseButton();
    // Remove the composition code option and verify the changes
    await opTimetablePage.clickOnEditTrain();
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await opSimulationSettingsPage.selectCodeCompoOption('__PLACEHOLDER__');
    await opTimetablePage.clickOnEditTrainSchedule();
    await opTimetablePage.getTrainArrivalTime('11:52');
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opOutputTablePage.verifyTimesStopsDataSheetVisibility();
    await performOnSpecificOSAndBrowser(
      async () => {
        await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
          'SpeedSpaceChart-SpeedLimitTagDisabled.png'
        );
      },
      {
        currentBrowser: browserName,
        actionName: 'visual assertion',
      }
    );
    await opOutputTablePage.getOutputTableData(expectedCellDataCodeCompoOFF);
  });
  test('Activate linear and mareco margin', async ({ page, browserName }) => {
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
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,

        cell.marginForm
      );
    }
    // Activate the 'Linear' margin
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await opSimulationSettingsPage.deactivateElectricalProfile();
    await opSimulationSettingsPage.activateLinearMargin();
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await opTimetablePage.getTrainArrivalTime('11:54');
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opOutputTablePage.verifyTimesStopsDataSheetVisibility();
    await performOnSpecificOSAndBrowser(
      async () => {
        await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
          'SpeedSpaceChart-LinearMargin.png'
        );
      },
      {
        currentBrowser: browserName,
        actionName: 'visual assertion',
      }
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await opOutputTablePage.getOutputTableData(expectedCellDataLinearMargin);
    await opTimetablePage.clickOnTimetableCollapseButton();
    // Modify the margin to 'Mareco' and verify the changes
    await opTimetablePage.clickOnEditTrain();
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await opSimulationSettingsPage.activateMarecoMargin();
    await opTimetablePage.clickOnEditTrainSchedule();
    await opTimetablePage.getTrainArrivalTime('11:54');
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opOutputTablePage.verifyTimesStopsDataSheetVisibility();
    await performOnSpecificOSAndBrowser(
      async () => {
        await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
          'SpeedSpaceChart-MarecoMargin.png'
        );
      },
      {
        currentBrowser: browserName,
        actionName: 'visual assertion',
      }
    );
    await opOutputTablePage.getOutputTableData(expectedCellDataMarecoMargin);
  });
  test('Add all the simulation settings', async ({ page, browserName }) => {
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
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,

        cell.marginForm
      );
    }
    // Activate the 'Linear' margin, electrical profile and composition code
    await operationalStudiesPage.clickOnSimulationSettingsTab();
    await opSimulationSettingsPage.checkElectricalProfile();
    await opSimulationSettingsPage.activateLinearMargin();
    await opSimulationSettingsPage.selectCodeCompoOption('HLP');
    // Add the train schedule and verify output results
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await opTimetablePage.getTrainArrivalTime('12:06');
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opOutputTablePage.verifyTimesStopsDataSheetVisibility();

    await performOnSpecificOSAndBrowser(
      async () => {
        await simulationResultPage.selectAllSpeedSpaceChartCheckboxes();
        await expect(simulationResultPage.speedSpaceChartTabindexElement).toHaveScreenshot(
          'SpeedSpaceChart-AllSettingsEnabled.png'
        );
      },
      {
        currentBrowser: browserName,
        actionName: 'visual assertion',
      }
    );
    await scrollContainer(page, '.time-stop-outputs .time-stops-datasheet .dsg-container');
    await opOutputTablePage.getOutputTableData(expectedCellDataForAllSettings);
  });
});
