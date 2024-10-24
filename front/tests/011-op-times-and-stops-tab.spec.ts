import { expect } from '@playwright/test';

import type { Project, Scenario, Study } from 'common/api/osrdEditoastApi';

import HomePage from './pages/home-page-model';
import OperationalStudiesInputTablePage from './pages/op-input-table-page-model';
import OperationalStudiesOutputTablePage from './pages/op-output-table-page-model';
import RoutePage from './pages/op-route-page-model';
import OperationalStudiesPage from './pages/operational-studies-page-model';
import RollingStockSelectorPage from './pages/rollingstock-selector-page-model';
import test from './test-logger';
import { readJsonFile } from './utils';
import { cleanWhitespace, cleanWhitespaceInArray, type StationData } from './utils/dataNormalizer';
import createScenario from './utils/scenario';
import scrollContainer from './utils/scrollHelper';
import { deleteScenario } from './utils/teardown-utils';
import enTranslations from '../public/locales/en/timesStops.json';
import frTranslations from '../public/locales/fr/timesStops.json';

test.describe('Times and Stops Tab Verification', () => {
  // Set viewport to ensure correct element visibility and interaction
  test.use({ viewport: { width: 1920, height: 1080 } });

  let project: Project;
  let study: Study;
  let scenario: Scenario;
  let OSRDLanguage: string;

  const dualRollingStockName = 'dual-mode_rolling_stock_test_e2e';

  // Load test data for table inputs and expected results
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

  // Waypoints data for route verification
  const expectedViaValues = [
    { name: 'Mid_West_station', ch: 'BV', uic: '3', km: 'KM 11.850' },
    { name: 'Mid_East_station', ch: 'BV', uic: '4', km: 'KM 26.300' },
  ];

  // Define interface for table cell data
  interface CellData {
    stationName: string;
    header: TranslationKeys;
    value: string;
    marginForm?: string;
  }

  type TranslationKeys = keyof typeof enTranslations;

  test.beforeEach(
    'Navigate to Times and Stops tab with rolling stock and route set',
    async ({ page }) => {
      const [operationalStudiesPage, routePage, rollingStockPage, homePage] = [
        new OperationalStudiesPage(page),
        new RoutePage(page),
        new RollingStockSelectorPage(page),
        new HomePage(page),
      ];

      await homePage.goToHomePage();
      OSRDLanguage = await homePage.getOSRDLanguage();

      // Set up scenario for operational study
      ({ project, study, scenario } = await createScenario());

      // Navigate to the operational study scenario page
      await page.goto(
        `/operational-studies/projects/${project.id}/studies/${study.id}/scenarios/${scenario.id}`
      );

      // Setup train configuration and schedule
      await operationalStudiesPage.checkInfraLoaded();
      await operationalStudiesPage.clickOnAddTrainButton();
      await operationalStudiesPage.setTrainScheduleName('Train-name-e2e-test');
      await page.waitForTimeout(500); // Wait for any async actions to complete
      await operationalStudiesPage.setTrainStartTime('11:22:40');
      await rollingStockPage.selectRollingStock(dualRollingStockName);

      // Perform route pathfinding
      await operationalStudiesPage.clickOnRouteTab();
      await routePage.performPathfindingByTrigram('WS', 'NES');

      // Navigate to the Times and Stops tab and scroll to the data sheet
      await operationalStudiesPage.clickOnTimesAndStopsTab();
      await scrollContainer(page, '.time-stops-datasheet .dsg-container');
    }
  );

  test.afterEach('Delete the created scenario', async () => {
    await deleteScenario(project.id, study.id, scenario.name);
  });

  test('should correctly set and display times and stops tables', async ({ page }) => {
    const [opInputTablePage, opOutputTablePage, operationalStudiesPage, routePage] = [
      new OperationalStudiesInputTablePage(page),
      new OperationalStudiesOutputTablePage(page),
      new OperationalStudiesPage(page),
      new RoutePage(page),
    ];

    // Set translations based on selected language
    const translations = OSRDLanguage === 'English' ? enTranslations : frTranslations;
    const expectedColumnNames = cleanWhitespaceInArray([
      translations.name,
      'Ch',
      translations.arrivalTime,
      translations.departureTime,
      translations.stopTime,
      translations.receptionOnClosedSignal,
      translations.shortSlipDistance,
      translations.theoreticalMargin,
    ]);

    // Verify table headers match the expected headers
    const actualColumnHeaders = cleanWhitespaceInArray(
      await opInputTablePage.columnHeaders.allInnerTexts()
    );
    expect(actualColumnHeaders).toEqual(expectedColumnNames);

    // Verify initial row count and fill table with input data
    await opInputTablePage.verifyActiveRowsCount(2);
    for (const cell of initialInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        OSRDLanguage,
        cell.marginForm
      );
    }

    // Verify changes to the input table and additional rows
    await opInputTablePage.verifyActiveRowsCount(4);
    await opInputTablePage.verifyDeleteButtons(2);
    await opInputTablePage.verifyInputTableData(inputExpectedData);

    // Validate waypoints after switching to the Route tab
    await operationalStudiesPage.clickOnRouteTab();
    for (const [viaIndex, expectedValue] of expectedViaValues.entries()) {
      const droppedWaypoint = routePage.droppedWaypoints.nth(viaIndex);
      await RoutePage.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );
    }

    // Add train schedule, verify results and output table data
    await operationalStudiesPage.addTrainSchedule();
    await operationalStudiesPage.returnSimulationResult();
    await opOutputTablePage.verifyTimeStopsDataSheetVisibility();

    // Scroll and extract output table data for verification
    await scrollContainer(page, '.osrd-simulation-container .time-stops-datasheet .dsg-container');
    await opOutputTablePage.getOutputTableData(outputExpectedCellData, OSRDLanguage);
  });

  test('should correctly update and clear input table row', async ({ page }) => {
    const [opInputTablePage, operationalStudiesPage, routePage] = [
      new OperationalStudiesInputTablePage(page),
      new OperationalStudiesPage(page),
      new RoutePage(page),
    ];

    const translations = OSRDLanguage === 'English' ? enTranslations : frTranslations;

    // Fill table cells with initial input data
    for (const cell of initialInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        OSRDLanguage,
        cell.marginForm
      );
    }

    await opInputTablePage.verifyInputTableData(inputExpectedData);

    // Update table inputs with new data
    await opInputTablePage.verifyActiveRowsCount(4);
    for (const cell of updatedInputsData) {
      const translatedHeader = cleanWhitespace(translations[cell.header]);
      await opInputTablePage.fillTableCellByStationAndHeader(
        cell.stationName,
        translatedHeader,
        cell.value,
        OSRDLanguage,
        cell.marginForm
      );
    }

    // Delete a row and verify changes
    await opInputTablePage.verifyDeleteButtons(2);
    await opInputTablePage.deleteButtons.nth(0).click();
    await opInputTablePage.verifyActiveRowsCount(4); // No reduction in rows after deletion
    await opInputTablePage.verifyDeleteButtons(1);
    await opInputTablePage.verifyInputTableData(updatedCellData);

    // Verify waypoints after switching to the Route tab
    await operationalStudiesPage.clickOnRouteTab();
    for (const [viaIndex, expectedValue] of expectedViaValues.entries()) {
      const droppedWaypoint = routePage.droppedWaypoints.nth(viaIndex);
      await RoutePage.validateAddedWaypoint(
        droppedWaypoint,
        expectedValue.name,
        expectedValue.ch,
        expectedValue.uic
      );
    }
  });
});
