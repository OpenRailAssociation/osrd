import { test } from '@playwright/test';
import STDCMPage from './pages/stdcm-page-model';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra } from './utils/api-utils';
import type { Infra } from 'common/api/osrdEditoastApi';
import type { ConsistFields } from './utils/types';

test.describe('FeedbackCard Tests', () => {
  test.slow(); // Mark test as slow due to multiple steps
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
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
    stdcmPage = new STDCMPage(page);
    await page.goto('/stdcm');
    await page.waitForLoadState('networkidle');
    await stdcmPage.removeViteOverlay();

    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);
  });

  test('Verify FeedbackCard visibility', async () => {
    await stdcmPage.fillAndVerifyConsistDetails(consistDetails, '180', '40');
    await stdcmPage.fillAndVerifyOriginDetails();
    await stdcmPage.fillAndVerifyDestinationDetails();
    await stdcmPage.launchSimulation();

    await stdcmPage.verifyFeedbackCardVisibility();
    await stdcmPage.clickFeedbackButton();
    const expectedSubject = 'Feedback on the STDCM simulator';
    const expectedBody = `
********
Simulation details:

Traction Engine: electricRollingStockName
Composition Code: HLP
Tonnage: 180 t
Length: 40 m
Max Speed: 100 km/h

Origin: Perrigny BV
Destination: Miramas BV
Departure Time: 14:30

Please share your feedback here.
`;

    await stdcmPage.verifyMailRedirection(expectedSubject, expectedBody);
  });
});
