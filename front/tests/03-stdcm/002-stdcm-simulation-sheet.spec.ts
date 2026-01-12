import fs from 'fs';

import type { Infra } from 'common/api/osrdEditoastApi';

import { electricRollingStockName } from './../assets/constants/project-const';
import simulationSheetDetails from './../assets/constants/simulation-sheet-const';
import test from './../page-object-fixture';
import ConsistSection from './../pages/stdcm/consist-section';
import DestinationSection from './../pages/stdcm/destination-section';
import OriginSection from './../pages/stdcm/origin-section';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra } from './../utils/api-utils';
import { findFirstPdf, parsePdfText, verifySimulationContent } from './../utils/pdf-parser';
import type { ConsistFields, PdfSimulationContent } from './../utils/types';

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

test.describe('@stdcm @stdcm-sheet', () => {
  test.describe.configure({ mode: 'serial' });

  let infra: Infra;
  let downloadDir: string | undefined;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto('/stdcm');
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('@smoke Verify STDCM stops and simulation sheet', async ({
    browserName,
    context,
    consistSection,
    originSection,
    destinationSection,
    viaSection,
    stdcmPage,
    stdcmSimulationResultPage,
  }, testInfo) => {
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
        await stdcmSimulationResultPage.mapMarkerResultVisibility();
      }
      await stdcmSimulationResultPage.verifyTableData(
        './tests/assets/stdcm/stdcm-without-all-via.json'
      );
      await stdcmSimulationResultPage.displayAllOperationalPoints();
      await stdcmSimulationResultPage.verifyTableData(
        './tests/assets/stdcm/stdcm-with-all-via.json'
      );
    });

    await test.step('Retain & download simulation PDF', async () => {
      await stdcmSimulationResultPage.retainSimulation();
      downloadDir = testInfo.outputDir;
      await stdcmSimulationResultPage.downloadSimulation(downloadDir);
    });

    await test.step('Start a new query and verify fields are reset', async () => {
      const [newPage] = await Promise.all([
        context.waitForEvent('page'),
        stdcmSimulationResultPage.startNewQuery(),
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
  test('@smoke Verify simulation sheet content', async () => {
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
