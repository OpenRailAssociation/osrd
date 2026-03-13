import type { Infra } from 'common/api/osrdEditoastApi';

import test from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra } from './../utils/api-utils';
import getMailFeedbackData from '../assets/constants/stdcm/mail-feedback-const';
import {
  CONSIST_DETAILS,
  DEFAULT_DETAILS,
  SIMULATION_RESULTS_DETAILS,
  STDCM_URL,
  TRACTION_ENGINE_PREFILLED_VALUES,
} from '../assets/constants/stdcm/stdcm-const';

test.describe('@stdcm @stdcm-feedback', () => {
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
      await originSection.fillOriginDetailsLight();
      await destinationSection.fillDestinationDetailsLight();
    });

    await test.step('Launch simulation and verify simulation details', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmSimulationResultPage.verifySimulationDetails(SIMULATION_RESULTS_DETAILS);
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
