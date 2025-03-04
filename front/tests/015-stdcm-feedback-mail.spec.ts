import { test } from '@playwright/test';

import type { Infra } from 'common/api/osrdEditoastApi';

import { expectedBody, expectedSubject } from './assets/constants/mail-feedback-const';
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
    tractionEngine: 'electricRollingStockName',
    towedRollingStock: 'HLP',
    tonnage: '180',
    length: '40',
    speedLimitTag: 'MA100',
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

  test('Verify FeedbackCard visibility', async () => {
    await consistSection.fillAndVerifyConsistDetails(consistDetails, '180', '40');
    await originSection.fillAndVerifyOriginDetails();
    await destinationSection.fillAndVerifyDestinationDetails();
    await stdcmPage.launchSimulation();

    await simulationResultPage.verifyFeedbackCardVisibility();
    await simulationResultPage.clickFeedbackButton();

    await simulationResultPage.verifyMailRedirection(expectedSubject, expectedBody);
  });
});
