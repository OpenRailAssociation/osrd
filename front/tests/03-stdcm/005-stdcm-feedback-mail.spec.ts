import type { Infra } from 'common/api/osrdEditoastApi';

import getMailFeedbackData from './../assets/constants/mail-feedback-const';
import { electricRollingStockName } from './../assets/constants/project-const';
import test from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra } from './../utils/api-utils';
import type { ConsistFields } from './../utils/types';

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

test.describe('@stdcm @stdcm-feedback', () => {
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto('/stdcm');
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
      await consistSection.fillAndVerifyConsistDetails(
        consistDetails,
        tractionEnginePrefilledValues.tonnage,
        tractionEnginePrefilledValues.length,
        tractionEnginePrefilledValues.maxSpeed
      );
    });

    await test.step('Fill origin and destination', async () => {
      await originSection.fillOriginDetailsLight();
      await destinationSection.fillDestinationDetailsLight();
    });

    await test.step('Launch simulation and verify simulation details', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmSimulationResultPage.verifySimulationDetails({
        simulationIndex: 0,
        simulationLengthAndDuration: '51 km — 33min',
        validSimulationNumber: 1,
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
