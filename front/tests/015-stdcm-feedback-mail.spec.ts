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

test.describe('FeedbackCard Tests', () => {
  test.slow(); // Mark test as slow due to multiple steps
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let consistSection: ConsistSection;
  let originSection: OriginSection;
  let destinationSection: DestinationSection;
  let simulationResultPage: SimulationResultPage;
  let infra: Infra;

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
    await page.waitForLoadState('networkidle');
    await stdcmPage.removeViteOverlay();
    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);
  });

  test('Verify FeedbackCard visibility and mail redirection', async () => {
    await consistSection.fillAndVerifyConsistDetails(
      consistDetails,
      tractionEnginePrefilledValues.tonnage,
      tractionEnginePrefilledValues.length,
      tractionEnginePrefilledValues.maxSpeed
    );
    await originSection.fillOriginDetailsLight();
    await destinationSection.fillDestinationDetailsLight();
    await stdcmPage.launchSimulation();
    await simulationResultPage.verifySimulationDetails({
      simulationIndex: 0,
      simulationLengthAndDuration: '51 km — 45min',
      validSimulationNumber: 1,
    });
    await simulationResultPage.verifyFeedbackCardVisibility();

    const { expectedSubject, expectedBody, expectedMail } = getMailFeedbackData();
    await simulationResultPage.verifyMailRedirection(expectedSubject, expectedBody, expectedMail);
  });
});
