import fs from 'fs';

import type { Infra } from 'common/api/osrdEditoastApi';

import simulationSheetDetails from '../assets/constants/stdcm/simulation-sheet-const';
import {
  CI_SUGGESTIONS,
  CONSIST_DETAILS,
  DEFAULT_DETAILS,
  DESTINATION_DETAILS,
  LIGHT_DESTINATION_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  ORIGIN_DETAILS,
  STDCM_TRANSLATIONS,
  STDCM_URL,
  STDCM_WITH_ALL_VIA_DATA_PATH,
  STDCM_WITHOUT_ALL_VIA_DATA_PATH,
  TRACTION_ENGINE_PREFILLED_VALUES,
  VIA_STOP_TIMES,
  VIA_STOP_TYPES,
  VIA_SUGGESTIONS,
} from '../assets/constants/stdcm/stdcm-const';
import test from './../page-object-fixture';
import ConsistSection from './../pages/stdcm/consist-section';
import DestinationSection from './../pages/stdcm/destination-section';
import OriginSection from './../pages/stdcm/origin-section';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra } from './../utils/api-utils';
import { findFirstPdf, parsePdfText, verifySimulationContent } from './../utils/pdf-parser';
import type { PdfSimulationContent } from './../utils/types';

test.describe('@stdcm @stdcm-sheet', () => {
  test.describe.configure({ mode: 'serial' });

  let infra: Infra;
  let downloadDir: string | undefined;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto(STDCM_URL);
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
      await consistSection.fillAndVerifyConsistDetails({
        consistFields: CONSIST_DETAILS,
        defaultMaxSpeed: DEFAULT_DETAILS.maxSpeed,
        tractionEnginePrefilledValues: {
          expectedTonnage: TRACTION_ENGINE_PREFILLED_VALUES.tonnage,
          expectedLength: TRACTION_ENGINE_PREFILLED_VALUES.length,
        },
      });

      await originSection.fillOriginDetailsLight({
        originDetails: {
          ...LIGHT_ORIGIN_DETAILS,
          suggestionText: CI_SUGGESTIONS.north[2],
        },
        expectedSuggestions: CI_SUGGESTIONS.north,
        expectedCiValue: CI_SUGGESTIONS.north[2],
      });

      await destinationSection.fillDestinationDetailsLight({
        destinationDetails: {
          ...LIGHT_DESTINATION_DETAILS,
          expectedCiValue: CI_SUGGESTIONS.south[1],
        },
        southSuggestions: CI_SUGGESTIONS.south,
        suggestionText: CI_SUGGESTIONS.south[1],
      });

      await viaSection.fillAndVerifyViaDetails({
        viaNumber: 1,
        ciSearchText: 'mid_west',
        expectedChValue: DEFAULT_DETAILS.chValue,
        stopTypes: VIA_STOP_TYPES,
        stopTimes: VIA_STOP_TIMES,
        suggestionTextBySearch: {
          mid_west: VIA_SUGGESTIONS[0],
          mid_east: VIA_SUGGESTIONS[1],
          nS: VIA_SUGGESTIONS[2],
        },
        driverSwitchTooShortWarning:
          STDCM_TRANSLATIONS.stdcmErrors.routeErrors.viaStopDurationDriverSwitchTooShort,
      });
    });

    await test.step('Verify input map markers (Chromium only)', async () => {
      if (browserName === 'chromium') {
        await stdcmPage.mapMarkerVisibility();
      }
    });

    await test.step('Launch simulation', async () => {
      await stdcmPage.verifyValidSimulationLaunch(
        STDCM_TRANSLATIONS.simulation.results.status.completed
      );
    });

    await test.step('Verify result map markers and tables', async () => {
      if (browserName === 'chromium') {
        await stdcmSimulationResultPage.mapMarkerResultVisibility();
      }
      await stdcmSimulationResultPage.verifyTableData(STDCM_WITHOUT_ALL_VIA_DATA_PATH);
      await stdcmSimulationResultPage.displayAllOperationalPoints();
      await stdcmSimulationResultPage.verifyTableData(STDCM_WITH_ALL_VIA_DATA_PATH);
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

      await newConsistSection.verifyDefaultConsistFields({
        defaultSpeedLimitTag: DEFAULT_DETAILS.speedLimitTag,
      });

      await newOriginSection.verifyDefaultOriginFields({
        arrivalType: ORIGIN_DETAILS.arrivalType.default,
        arrivalDate: DEFAULT_DETAILS.arrivalDate,
        arrivalTime: DEFAULT_DETAILS.arrivalTime,
        tolerance: DEFAULT_DETAILS.tolerance,
      });

      await newDestinationSection.verifyDefaultDestinationFields(
        DESTINATION_DETAILS.arrivalType.default
      );
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
