import { test, expect } from '@playwright/test';

import type { Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import HomePage from './pages/home-page-model';
import OperationalStudiesInputTablePage from './pages/op-input-table-page-model';
import OperationalStudiesOutputTablePage from './pages/op-output-table-page-model';
import OperationalStudiesTimetablePage from './pages/op-timetable-page-model';
import OperationalStudiesPage from './pages/operational-studies-page-model';
import ScenarioPage from './pages/scenario-page-model';
import { readJsonFile } from './utils';
import { cleanWhitespace, cleanWhitespaceInArray, type StationData } from './utils/dataNormalizer';
import setupScenario from './utils/scenario';
import scrollContainer from './utils/scrollHelper';
import enTranslations from '../public/locales/en/timesStops.json';
import frTranslations from '../public/locales/fr/timesStops.json';

let project: Project;
let study: Study;
let scenario: Scenario;
let selectedLanguage: string;

type TranslationKeys = keyof typeof enTranslations;

// Define CellData interface for table cell data
interface CellData {
  stationName: string;
  header: TranslationKeys;
  value: string;
  marginForm?: string;
}

const dualRollingStockName = 'dual-mode_rolling_stock_test_e2e';

const initialInputsData: CellData[] = readJsonFile(
  './tests/assets/operationStudies/timesAndStops/initialInputs.json'
);
const updatedInputsData: CellData[] = readJsonFile(
  './tests/assets/operationStudies/timesAndStops/updatedInputs.json'
);
const outputExpectedCellData: StationData[] = readJsonFile(
  './tests/assets/operationStudies/timesAndStops/expectedOutputsCellsData.json'
);
const inputExpectedData = readJsonFile(
  './tests/assets/operationStudies/timesAndStops/expectedInputsCellsData.json'
);
const updatedCellData = readJsonFile(
  './tests/assets/operationStudies/timesAndStops/updatedInputsCellsData.json'
);

const expectedViaValues = [
  { name: 'Mid_West_station', ch: 'BV', uic: '3', km: 'KM 11.850' },
  { name: 'Mid_East_station', ch: 'BV', uic: '4', km: 'KM 26.300' },
];

test.beforeEach(async ({ page }) => {
  // Create a new scenario
  ({ project, study, scenario } = await setupScenario());

  // Navigate to home page and retrieve the language setting
  const homePage = new HomePage(page);
  await homePage.goToHomePage();
  selectedLanguage = await homePage.getOSRDLanguage();

  // Go to the specific operational study scenario page
  await page.goto(
    `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
  );
});

test.describe('Times and Stops Tab Verification', () => {
  // Set viewport to avoid scrolling issues and ensure elements are attached to the DOM
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('should correctly set and display times and stops tables', async ({ page }) => {
    // Page models
    const [
      opInputTablePage,
      opTimetablePage,
      opOutputTablePage,
      operationalStudiesPage,
      scenarioPage,
    ] = [
      new OperationalStudiesInputTablePage(page),
      new OperationalStudiesTimetablePage(page),
      new OperationalStudiesOutputTablePage(page),
      new OperationalStudiesPage(page),
      new ScenarioPage(page),
    ];

    // Setup the initial train configuration and schedule
    await scenarioPage.checkInfraLoaded();
    await operationalStudiesPage.clickOnAddTrainBtn();
    await scenarioPage.setTrainScheduleName('Train-name-e2e-test');
    await page.waitForTimeout(500);
    await operationalStudiesPage.setTrainStartTime('11:22:40');
    await operationalStudiesPage.selectRollingStock(dualRollingStockName);

    // Perform pathfinding
    await scenarioPage.openTabByDataId('tab-pathfinding');
    await operationalStudiesPage.performPathfindingByTrigram('WS', 'NES');

    // Navigate to the Times and Stops tab and scroll into view
    await scenarioPage.openTabByDataId('tab-timesStops');
    await scrollContainer(page, '.time-stops-datasheet .dsg-container');

    // Set column names based on the selected language
    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
    const expectedColumnNames = cleanWhitespaceInArray([
      translations.name,
      translations.ch,
      translations.arrivalTime,
      translations.stopTime,
      translations.departureTime,
      translations.receptionOnClosedSignal,
      translations.shortSlipDistance,
      translations.theoreticalMargin,
    ]);

    // Verify that the actual column headers match the expected headers
    const actualColumnHeaders = cleanWhitespaceInArray(
      await opInputTablePage.columnHeaders.allInnerTexts()
    );
    expect(actualColumnHeaders).toEqual(expectedColumnNames);

    // Validate the initial active row count
    await opInputTablePage.verifyActiveRowsCount(2);

    // Fill in table cells based on the predefined cell data
    for (const cell of initialInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        selectedLanguage,
        cell.marginForm
      );
    }

    // Verify the table after modification
    await opInputTablePage.verifyActiveRowsCount(4);
    await opInputTablePage.verifyDeleteButtons(2);
    await opInputTablePage.verifyInputTableData(inputExpectedData);

    // Switch to Pathfinding tab and validate waypoints
    await scenarioPage.openTabByDataId('tab-pathfinding');
    for (const [viaIndex, expectedValue] of expectedViaValues.entries()) {
      const droppedWaypoint = operationalStudiesPage.droppedWaypoints.nth(viaIndex);
      await OperationalStudiesPage.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );
    }

    // Add the train schedule and verify simulation results
    await scenarioPage.addTrainSchedule();
    await scenarioPage.returnSimulationResult();
    await opTimetablePage.clickOnScenarioCollapseButton();
    await opTimetablePage.verifyTimeStopsDataSheetVisibility();
    // Scroll and extract data from output table
    await scrollContainer(page, '.osrd-simulation-container .time-stops-datasheet .dsg-container');
    await opOutputTablePage.getOutputTableData(outputExpectedCellData, selectedLanguage);
  });

  test('should correctly update and clear input table row', async ({ page }) => {
    // Page models
    const [opInputTablePage, operationalStudiesPage, scenarioPage] = [
      new OperationalStudiesInputTablePage(page),
      new OperationalStudiesPage(page),
      new ScenarioPage(page),
    ];

    // Setup initial train configuration
    await scenarioPage.checkInfraLoaded();
    await operationalStudiesPage.clickOnAddTrainBtn();
    await scenarioPage.setTrainScheduleName('Train-name-e2e-test');
    await page.waitForTimeout(500);
    await operationalStudiesPage.setTrainStartTime('11:22:40');
    await operationalStudiesPage.selectRollingStock(dualRollingStockName);

    // Perform pathfinding and navigate to Times and Stops tab
    await scenarioPage.openTabByDataId('tab-pathfinding');
    await operationalStudiesPage.performPathfindingByTrigram('WS', 'NES');
    await scenarioPage.openTabByDataId('tab-timesStops');
    await scrollContainer(page, '.time-stops-datasheet .dsg-container');

    const translations = selectedLanguage === 'English' ? enTranslations : frTranslations;
    // Fill in table cells based on the predefined cell data
    for (const cell of initialInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        selectedLanguage,
        cell.marginForm
      );
    }
    await opInputTablePage.verifyInputTableData(inputExpectedData);

    // Update table inputs
    await opInputTablePage.verifyActiveRowsCount(4);
    for (const cell of updatedInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        selectedLanguage,
        cell.marginForm
      );
    }

    // Delete a row and validate row count
    await opInputTablePage.verifyDeleteButtons(2);
    await opInputTablePage.deleteButtons.nth(0).click();
    await opInputTablePage.verifyActiveRowsCount(4);
    await opInputTablePage.verifyDeleteButtons(1);
    await opInputTablePage.verifyInputTableData(updatedCellData);

    // Switch to Pathfinding tab and validate waypoints
    await scenarioPage.openTabByDataId('tab-pathfinding');
    for (const [viaIndex, expectedValue] of expectedViaValues.entries()) {
      const droppedWaypoint = operationalStudiesPage.droppedWaypoints.nth(viaIndex);
      await OperationalStudiesPage.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );
    }
  });
});
