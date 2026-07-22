import fs from 'fs';

import { StdcmStopTypes } from 'applications/stdcm/types';
import type { Infra } from 'common/api/osrdEditoastApi';

import {
  CONSIST_CHANGE_ORIGIN_DETAILS,
  CONSIST_CHANGE_VIA_STOP_TIME,
  CONSIST_CHANGE_INITIAL_PREFILL,
  INITIAL_CONSIST_DETAILS,
  CONSIST_CHANGE_DETAILS,
  CONSIST_CHANGE_UPDATED_PREFILL,
  CONSIST_CHANGE_TRANSITIONS,
  CONSIST_CHANGE_PDF_CONTENT,
} from '../assets/constants/stdcm/consist-change-const';
import {
  CI_SUGGESTIONS,
  DEFAULT_DETAILS,
  LIGHT_DESTINATION_DETAILS,
  STDCM_TRANSLATIONS,
  STDCM_URL,
  TRACTION_ENGINE_PREFILLED_VALUES,
  VIA_SUGGESTIONS,
} from '../assets/constants/stdcm/stdcm-const';
import test from '../page-object-fixture';
import { waitForInfraStateToBeCached } from '../utils';
import { getInfra, setTowedRollingStock } from '../utils/api-utils';
import { findFirstPdf, parsePdfText, verifyConsistChangeContent } from '../utils/pdf-parser';

test.describe('STDCM Consist Change', { tag: ['@stdcm', '@stdcm-consist-change'] }, () => {
  test.describe.configure({ mode: 'serial' });

  let infra: Infra;
  let downloadDir: string | undefined;

  test.beforeAll('Fetch infrastructure and create towed rolling stock', async () => {
    [infra] = await Promise.all([getInfra(), setTowedRollingStock()]);
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto(STDCM_URL);
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify consist change form and simulation results', async ({
    consistSection,
    originSection,
    destinationSection,
    viaSection,
    consistChangeSection,
    stdcmPage,
    stdcmSimulationResultPage,
  }, testInfo) => {
    await test.step('Fill consist, origin and destination', async () => {
      await consistSection.fillAndVerifyConsistDetails({
        consistFields: INITIAL_CONSIST_DETAILS,
        defaultMaxSpeed: DEFAULT_DETAILS.maxSpeed,
        tractionEnginePrefilledValues: {
          expectedTonnage: TRACTION_ENGINE_PREFILLED_VALUES.tonnage,
          expectedLength: TRACTION_ENGINE_PREFILLED_VALUES.length,
        },
      });

      await originSection.fillOriginDetailsLight({
        originDetails: {
          ...CONSIST_CHANGE_ORIGIN_DETAILS,
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
    });

    await test.step('Add via 1 as service stop and open consist change', async () => {
      await viaSection.addServiceStopVia({
        viaNumber: 1,
        ciSearchText: 'mid_west',
        expectedChValue: DEFAULT_DETAILS.chValue,
        selectedSuggestionText: VIA_SUGGESTIONS[0],
        defaultViaType: StdcmStopTypes.PASSAGE_TIME,
        stopType: StdcmStopTypes.SERVICE_STOP,
        stopTime: CONSIST_CHANGE_VIA_STOP_TIME,
      });

      await consistChangeSection.verifyEditConsistButtonVisible(1);
      await consistChangeSection.clickEditConsist(1);
      await consistChangeSection.verifyConsistChangePrefilledValues(
        1,
        CONSIST_CHANGE_INITIAL_PREFILL
      );

      await consistChangeSection.modifyConsistChangeFields(1, CONSIST_CHANGE_DETAILS);
    });

    await test.step('Add via 2 and test consist change prefill/delete/reset', async () => {
      await viaSection.addServiceStopVia({
        viaNumber: 2,
        ciSearchText: 'mid_east',
        expectedChValue: DEFAULT_DETAILS.chValue,
        selectedSuggestionText: VIA_SUGGESTIONS[1],
        defaultViaType: StdcmStopTypes.PASSAGE_TIME,
        stopType: StdcmStopTypes.SERVICE_STOP,
        stopTime: CONSIST_CHANGE_VIA_STOP_TIME,
      });

      await consistChangeSection.clickEditConsist(2);
      await consistChangeSection.verifyConsistChangePrefilledValues(
        2,
        CONSIST_CHANGE_UPDATED_PREFILL
      );

      await consistChangeSection.deleteConsistChange(2);
      await consistChangeSection.verifyEditConsistButtonVisible(2);

      await consistChangeSection.clickEditConsist(2);
      await consistChangeSection.verifyConsistChangePrefilledValues(
        2,
        CONSIST_CHANGE_UPDATED_PREFILL
      );

      await viaSection.setViaStopType(2, StdcmStopTypes.PASSAGE_TIME);
      await consistChangeSection.verifyConsistChangeCardHidden(2);
      await consistChangeSection.verifyEditConsistButtonHidden(2);

      await viaSection.setViaStopType(2, StdcmStopTypes.SERVICE_STOP);
      await consistChangeSection.verifyConsistChangeCardHidden(2);
      await consistChangeSection.verifyEditConsistButtonVisible(2);
    });

    await test.step('Launch simulation with invalid consist change then recover', async () => {
      await consistChangeSection.clearConsistChangeTonnage(1);
      await consistChangeSection.clearConsistChangeLength(1);
      await stdcmPage.verifyInvalidSimulationLaunch();
      await stdcmPage.expectWarningBoxVisible();
      await stdcmPage.expectWarningBoxContains([
        STDCM_TRANSLATIONS.stdcmErrors.missingFields.viaConsistTotalMass,
        STDCM_TRANSLATIONS.stdcmErrors.missingFields.viaConsistTotalLength,
      ]);

      await consistChangeSection.modifyConsistChangeFields(1, {
        tonnage: CONSIST_CHANGE_DETAILS.tonnage,
        length: CONSIST_CHANGE_DETAILS.length,
      });
      await viaSection.setViaStopTime(2, CONSIST_CHANGE_VIA_STOP_TIME);
      await stdcmPage.expectWarningBoxHidden();

      await stdcmPage.verifyValidSimulationLaunch(
        STDCM_TRANSLATIONS.simulation.results.status.completed
      );
    });

    await test.step('Verify consist change row in results table', async () => {
      await stdcmSimulationResultPage.verifyConsistChangeInTable({
        consistChangeLabel: STDCM_TRANSLATIONS.consist.consistChange,
        tonnageLabel: STDCM_TRANSLATIONS.consist.tonnage,
        lengthLabel: STDCM_TRANSLATIONS.consist.length,
        tonnageTransition: CONSIST_CHANGE_TRANSITIONS.tonnage,
        lengthTransition: CONSIST_CHANGE_TRANSITIONS.length,
      });
    });

    await test.step('Retain & download simulation PDF', async () => {
      await stdcmSimulationResultPage.retainSimulation();
      downloadDir = testInfo.outputDir;
      await stdcmSimulationResultPage.downloadSimulation(downloadDir);
    });
  });

  /** *************** Test 2 **************** */
  test('Verify simulation sheet content with consist changes', async () => {
    const pdfFilePath = await test.step('Find the downloaded PDF', async () => {
      const filePath = findFirstPdf(downloadDir!);
      if (!filePath) {
        throw new Error(`No PDF files found in directory: ${downloadDir}`);
      }
      return filePath;
    });

    await test.step('Parse PDF and verify consist change content', async () => {
      const pdfBuffer = fs.readFileSync(pdfFilePath);
      const pdfText = await parsePdfText(pdfBuffer);

      verifyConsistChangeContent(pdfText, CONSIST_CHANGE_PDF_CONTENT);
    });
  });
});
