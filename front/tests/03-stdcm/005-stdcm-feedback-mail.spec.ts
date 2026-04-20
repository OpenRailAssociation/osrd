import type { Infra } from 'common/api/osrdEditoastApi';

import getMailFeedbackData from '../assets/constants/stdcm/mail-feedback-const';
import {
  CI_SUGGESTIONS,
  CONSIST_DETAILS,
  DEFAULT_DETAILS,
  LIGHT_DESTINATION_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  SIMULATION_RESULTS_DETAILS,
  STDCM_TRANSLATIONS,
  STDCM_URL,
  TRACTION_ENGINE_PREFILLED_VALUES,
} from '../assets/constants/stdcm/stdcm-const';
import test from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra } from './../utils/api-utils';

test.describe('STDCM mail feedback ', { tag: ['@stdcm', '@stdcm-feedback'] }, () => {
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto(STDCM_URL);
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify feedback card visibility and mail redirection', async ({
    stdcmPage,
    consistSection,
    originSection,
    destinationSection,
    stdcmSimulationResultPage,
  }) => {
    await test.step('Fill consist with traction engine details and verify prefilled values', async () => {
      await consistSection.fillAndVerifyConsistDetails({
        consistFields: CONSIST_DETAILS,
        defaultMaxSpeed: DEFAULT_DETAILS.maxSpeed,
        tractionEnginePrefilledValues: {
          expectedTonnage: TRACTION_ENGINE_PREFILLED_VALUES.tonnage,
          expectedLength: TRACTION_ENGINE_PREFILLED_VALUES.length,
        },
      });
    });

    await test.step('Fill origin and destination', async () => {
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
    });

    await test.step('Launch simulation and verify simulation details', async () => {
      await stdcmPage.verifyValidSimulationLaunch(
        STDCM_TRANSLATIONS.simulation.results.status.completed
      );
      await stdcmSimulationResultPage.verifySimulationDetails({
        ...SIMULATION_RESULTS_DETAILS,
        noOutputSimulationName: STDCM_TRANSLATIONS.simulation.results.simulationName.withoutOutputs,
      });
    });

    await test.step('Verify feedback card is visible', async () => {
      await stdcmSimulationResultPage.verifyFeedbackCardVisibility();
    });

    await test.step('Verify mail redirection from feedback card', async () => {
      const { expectedSubject, expectedBody, expectedMail } = getMailFeedbackData();
      await stdcmSimulationResultPage.verifyMailRedirection(
        expectedSubject,
        expectedBody,
        expectedMail
      );
    });
  });
});
