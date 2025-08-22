import fs from 'fs';

import type { Infra } from 'common/api/osrdEditoastApi';

import { electricRollingStockName } from './assets/constants/project-const';
import simulationSheetDetails from './assets/constants/simulation-sheet-const';
import test from './logging-fixture';
import ConsistSection from './pages/stdcm/consist-section';
import DestinationSection from './pages/stdcm/destination-section';
import OriginSection from './pages/stdcm/origin-section';
import SimulationResultPage from './pages/stdcm/simulation-results-page';
import STDCMPage from './pages/stdcm/stdcm-page';
import ViaSection from './pages/stdcm/via-section';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import { findFirstPdf, parsePdfText, verifySimulationContent } from './utils/pdf-parser';
import type { ConsistFields, PdfSimulationContent } from './utils/types';

const consistDetails: ConsistFields = {
  tractionEngine: electricRollingStockName,
  tonnage: '950',
  length: '567',
  maxSpeed: '100',
  speedLimitTag: 'HLP',
};
const tractionEnginePrefilledValues = {
  tonnage: '900',
  length: '400',
  maxSpeed: '288',
};

test.describe('Verify stdcm simulation page', () => {
  test.describe.configure({ mode: 'serial' });
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let consistSection: ConsistSection;
  let originSection: OriginSection;
  let viaSection: ViaSection;
  let destinationSection: DestinationSection;
  let simulationResultPage: SimulationResultPage;

  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    [
      stdcmPage,
      consistSection,
      originSection,
      viaSection,
      destinationSection,
      simulationResultPage,
    ] = [
      new STDCMPage(page),
      new ConsistSection(page),
      new OriginSection(page),
      new ViaSection(page),
      new DestinationSection(page),
      new SimulationResultPage(page),
    ];

    await page.goto('/stdcm');
    await stdcmPage.removeViteOverlay();
    await waitForInfraStateToBeCached(infra.id);
  });

  let downloadDir: string | undefined;

  /** *************** Test 1 **************** */
  test('Verify STDCM stops and simulation sheet', async ({ browserName, context }, testInfo) => {
    await test.step('Fill consist, origin, destination and via', async () => {
      await consistSection.fillAndVerifyConsistDetails(
        consistDetails,
        tractionEnginePrefilledValues.tonnage,
        tractionEnginePrefilledValues.length,
        tractionEnginePrefilledValues.maxSpeed
      );
      await originSection.fillOriginDetailsLight();
      await destinationSection.fillDestinationDetailsLight();
      await viaSection.fillAndVerifyViaDetails({ viaNumber: 1, ciSearchText: 'mid_west' });
    });

    await test.step('Verify input map markers (Chromium only)', async () => {
      if (browserName === 'chromium') {
        await stdcmPage.mapMarkerVisibility();
      }
    });

    await test.step('Launch simulation', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
    });

    await test.step('Verify result map markers and tables', async () => {
      if (browserName === 'chromium') {
        await simulationResultPage.mapMarkerResultVisibility();
      }
      await simulationResultPage.verifyTableData('./tests/assets/stdcm/stdcm-without-all-via.json');
      await simulationResultPage.displayAllOperationalPoints();
      await simulationResultPage.verifyTableData('./tests/assets/stdcm/stdcm-with-all-via.json');
    });

    await test.step('Retain & download simulation PDF', async () => {
      await simulationResultPage.retainSimulation();
      downloadDir = testInfo.outputDir;
      await simulationResultPage.downloadSimulation(downloadDir);
    });

    await test.step('Start a new query and verify fields are reset', async () => {
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        simulationResultPage.startNewQuery(),
      ]);
      await newPage.waitForLoadState();

      const [newConsistSection, newOriginSection, newDestinationSection] = [
        new ConsistSection(newPage),
        new OriginSection(newPage),
        new DestinationSection(newPage),
      ];

      await newConsistSection.verifyDefaultConsistFields();
      await newOriginSection.verifyDefaultOriginFields();
      await newDestinationSection.verifyDefaultDestinationFields();
    });
  });

  /** *************** Test 2 *************** */
  test('Verify simulation sheet content', async () => {
    const pdfFilePath = await test.step('Find the downloaded PDF', async () => {
      const filePath = findFirstPdf(downloadDir!);
      if (!filePath) {
        throw new Error(`No PDF files found in directory: ${downloadDir}`);
      }
      return filePath;
    });

    await test.step('Parse PDF and compare with expected content', async () => {
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      const actualPdfSimulationContent = await parsePdfText(pdfBuffer);
      const expectedPdfSimulationContent: PdfSimulationContent = simulationSheetDetails();
      verifySimulationContent(actualPdfSimulationContent, expectedPdfSimulationContent);
    });
  });
});
