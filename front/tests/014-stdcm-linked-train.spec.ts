import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import { fastRollingStockName } from './assets/project-const';
import test from './logging-fixture';
import STDCMLinkedTrainPage from './pages/stdcm-linked-train-page-model';
import STDCMPage from './pages/stdcm-page-model';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra, setTowedRollingStock } from './utils/api-setup';
import type { ConsistFields } from './utils/types';

test.describe('Verify stdcm simulation page', () => {
  test.slow(); // Mark test as slow due to multiple steps
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let stdcmLinkedTrainPage: STDCMLinkedTrainPage;

  let infra: Infra;
  let createdTowedRollingStock: TowedRollingStock;
  let towedConsistDetails: ConsistFields;

  const fastRollingStockPrefilledValues = {
    tonnage: '190',
    length: '46',
    maxSpeed: '220',
  };
  const towedRollingStockPrefilledValues = {
    tonnage: '46',
    length: '26',
    maxSpeed: '180',
  };

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
    createdTowedRollingStock = await setTowedRollingStock();
    towedConsistDetails = {
      tractionEngine: fastRollingStockName,
      towedRollingStock: createdTowedRollingStock.name,
    };
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    [stdcmPage, stdcmLinkedTrainPage] = [new STDCMPage(page), new STDCMLinkedTrainPage(page)];
    // Navigate to STDCM page
    await page.goto('/stdcm');
    await page.waitForLoadState('networkidle');
    await stdcmPage.removeViteOverlay();

    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify STDCM anterior linked train', async ({ page: _ }, testInfo) => {
    await stdcmPage.fillAndVerifyConsistDetails(
      towedConsistDetails,
      fastRollingStockPrefilledValues.tonnage,
      fastRollingStockPrefilledValues.length,
      towedRollingStockPrefilledValues.tonnage,
      towedRollingStockPrefilledValues.length
    );
    await stdcmLinkedTrainPage.anteriorLinkedPathDetails();
    await stdcmPage.fillAndVerifyViaDetails({
      viaNumber: 1,
      ciSearchText: 'nS',
    });
    await stdcmPage.fillDestinationDetailsLight();
    await stdcmPage.launchSimulation();
    await stdcmPage.verifyTableData(
      './tests/assets/stdcm/linkedTrain/anteriorLinkedTrainTable.json'
    );
    await stdcmPage.retainSimulation();
    await stdcmPage.downloadSimulation(testInfo.outputDir);
  });

  /** *************** Test 2 **************** */
  test('Verify STDCM posterior linked train', async ({ page: _ }, testInfo) => {
    await stdcmPage.fillAndVerifyConsistDetails(
      towedConsistDetails,
      fastRollingStockPrefilledValues.tonnage,
      fastRollingStockPrefilledValues.length,
      towedRollingStockPrefilledValues.tonnage,
      towedRollingStockPrefilledValues.length
    );
    await stdcmLinkedTrainPage.posteriorLinkedPathDetails();
    await stdcmPage.fillAndVerifyViaDetails({
      viaNumber: 1,
      ciSearchText: 'mid_east',
    });
    await stdcmPage.fillOriginDetailsLight('respectDestinationSchedule', true);
    await stdcmPage.launchSimulation();
    await stdcmPage.verifyTableData(
      './tests/assets/stdcm/linkedTrain/posteriorLinkedTrainTable.json'
    );
    await stdcmPage.retainSimulation();
    await stdcmPage.downloadSimulation(testInfo.outputDir);
  });
});
