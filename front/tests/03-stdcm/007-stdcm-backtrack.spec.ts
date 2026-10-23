import { expect } from '@playwright/test';

import { StdcmStopTypes } from 'applications/stdcm/types';
import type { Infra } from 'common/api/osrdEditoastApi';

import {
  BACKTRACK_DETAILS,
  CI_SUGGESTIONS,
  CONSIST_DETAILS,
  DEFAULT_DETAILS,
  LIGHT_DESTINATION_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  STDCM_TRANSLATIONS,
  STDCM_URL,
  TRACTION_ENGINE_PREFILLED_VALUES,
  VIA_STOP_TIMES,
} from '../assets/constants/stdcm/stdcm-const';
import test from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra } from './../utils/api-utils';
import { countImagesOfSize, parsePdfText, readFirstPdf } from './../utils/pdf-parser';

test.describe(
  'STDCM simulation with a backtrack on a stop',
  { tag: ['@stdcm', '@backtrack'] },
  () => {
    let infra: Infra;

    test.beforeAll('Fetch infrastructure', async () => {
      infra = await getInfra();
    });

    test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
      await page.goto(STDCM_URL);
      await waitForInfraStateToBeCached(infra.id);
    });

    /** *************** Test 1 **************** */
    test('Run a STDCM simulation with a backtrack on a stop', async ({
      browserName,
      consistSection,
      originSection,
      viaSection,
      destinationSection,
      stdcmPage,
      stdcmSimulationResultPage,
    }, testInfo) => {
      await test.step('Fill a path that forces a backtrack', async () => {
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
            input: BACKTRACK_DETAILS.input,
            suggestionText: BACKTRACK_DETAILS.origin,
          },
          expectedSuggestions: BACKTRACK_DETAILS.suggestions,
          expectedCiValue: BACKTRACK_DETAILS.origin,
        });

        await destinationSection.fillDestinationDetailsLight({
          destinationDetails: {
            ...LIGHT_DESTINATION_DETAILS,
            input: LIGHT_ORIGIN_DETAILS.input,
            expectedCiValue: BACKTRACK_DETAILS.destination,
          },
          southSuggestions: CI_SUGGESTIONS.north,
          suggestionText: BACKTRACK_DETAILS.destination,
        });

        // A service stop allows the train to backtrack at the via
        await viaSection.addServiceStopVia({
          viaNumber: 1,
          ciSearchText: BACKTRACK_DETAILS.viaSearchText,
          expectedChValue: DEFAULT_DETAILS.chValue,
          expectAutofilledCh: true,
          selectedSuggestionText: BACKTRACK_DETAILS.via,
          defaultViaType: StdcmStopTypes.PASSAGE_TIME,
          stopType: StdcmStopTypes.SERVICE_STOP,
          stopTime: VIA_STOP_TIMES.serviceStop.input,
        });
      });

      await test.step('Launch the simulation and verify a solution is found', async () => {
        await stdcmPage.verifyValidSimulationLaunch(
          STDCM_TRANSLATIONS.simulation.results.status.completed
        );
        await stdcmSimulationResultPage.verifySingleSimulationResult();
      });

      await test.step('Verify the backtrack in the results table', async () => {
        await stdcmSimulationResultPage.verifyBacktrackInTable(
          BACKTRACK_DETAILS.operationalPointNames[1],
          STDCM_TRANSLATIONS.simulation.results.backtrack
        );
      });

      await test.step('Verify the path and the backtrack on the map (Chromium only)', async () => {
        if (browserName === 'chromium') {
          await stdcmSimulationResultPage.mapMarkerResultVisibility();
          await stdcmSimulationResultPage.verifyBacktrackOnMap();
        }
      });

      await test.step('Download and verify the simulation sheet', async () => {
        await stdcmSimulationResultPage.retainSimulation();
        await stdcmSimulationResultPage.downloadSimulation(testInfo.outputDir);

        const pdfBuffer = readFirstPdf(testInfo.outputDir);
        const pdfText = await parsePdfText(pdfBuffer);
        for (const operationalPoint of BACKTRACK_DETAILS.operationalPointNames) {
          expect(pdfText).toContain(operationalPoint);
        }
        // The backtrack icon is shown exactly once in the simulation sheet
        expect(await countImagesOfSize(pdfBuffer, 64, 64)).toBe(1);
      });
    });
  }
);
