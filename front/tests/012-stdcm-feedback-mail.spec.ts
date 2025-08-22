import { test } from '@playwright/test';

import type { Infra } from 'common/api/osrdEditoastApi';

import getMailFeedbackData from './assets/constants/mail-feedback-const';
import { electricRollingStockName } from './assets/constants/project-const';
import ConsistSection from './pages/stdcm/consist-section';
import DestinationSection from './pages/stdcm/destination-section';
import OriginSection from './pages/stdcm/origin-section';
import SimulationResultPage from './pages/stdcm/simulation-results-page';
import STDCMPage from './pages/stdcm/stdcm-page';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import type { ConsistFields } from './utils/types';

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

test.describe('Stdcm feedback card', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let consistSection: ConsistSection;
  let originSection: OriginSection;
  let destinationSection: DestinationSection;
  let simulationResultPage: SimulationResultPage;
  let infra: Infra;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    [stdcmPage, consistSection, originSection, destinationSection, simulationResultPage] = [
      new STDCMPage(page),
      new ConsistSection(page),
      new OriginSection(page),
      new DestinationSection(page),
      new SimulationResultPage(page),
    ];
    await page.goto('/stdcm');
    await stdcmPage.removeViteOverlay();
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify feedback card visibility and mail redirection', async () => {
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
      await simulationResultPage.verifySimulationDetails({
        simulationIndex: 0,
        simulationLengthAndDuration: '51 km — 33min',
        validSimulationNumber: 1,
      });
    });

    await test.step('Verify feedback card is visible', async () => {
      await simulationResultPage.verifyFeedbackCardVisibility();
    });

    await test.step('Verify mail redirection from feedback card', async () => {
      const { expectedSubject, expectedBody, expectedMail } = getMailFeedbackData();
      await simulationResultPage.verifyMailRedirection(expectedSubject, expectedBody, expectedMail);
    });
  });
});
