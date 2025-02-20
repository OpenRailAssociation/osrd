import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import { electricRollingStockName, fastRollingStockName } from './assets/project-const';
import test from './logging-fixture';
import STDCMLinkedTrainPage from './pages/stdcm-linked-train-page-model';
import STDCMPage from './pages/stdcm-page-model';
import { handleAndVerifyInput, waitForInfraStateToBeCached } from './utils';
import { getInfra, setTowedRollingStock } from './utils/api-setup';
import type { ConsistFields } from './utils/types';

test.describe('Verify stdcm simulation page', () => {
  test.slow(); // Mark test as slow due to multiple steps
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let stdcmLinkedTrainPage: STDCMLinkedTrainPage;

  let infra: Infra;
  let createdTowedRollingStock: TowedRollingStock;

  const UPDATED_ORIGIN_ARRIVAL_DATE = '18/10/24';
  const consistDetails: ConsistFields = {
    tractionEngine: electricRollingStockName,
    tonnage: '950',
    length: '567',
    speedLimitTag: 'HLP',
  };
  const tractionEnginePrefilledValues = {
    tonnage: '900',
    length: '400',
  };
  const fastRollingStockPrefilledValues = {
    tonnage: '190',
    length: '46',
  };
  const towedRollingStockPrefilledValues = {
    tonnage: '46',
    length: '26',
  };

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
    createdTowedRollingStock = await setTowedRollingStock();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    [stdcmPage, stdcmLinkedTrainPage] = [new STDCMPage(page), new STDCMLinkedTrainPage(page)];
    await page.goto('/stdcm');
    await page.waitForLoadState('networkidle');
    await stdcmPage.removeViteOverlay();

    // Wait for infra to be in 'CACHED' state before proceeding
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify default STDCM page', async () => {
    // Verify visibility of STDCM elements and handle default fields

    await stdcmPage.verifyStdcmElementsVisibility();
    await stdcmPage.verifyAllDefaultPageFields();
    await stdcmPage.addAndDeletedDefaultVia();
    await stdcmLinkedTrainPage.addAndDeleteDefaultLinkedPath();
  });

  /** *************** Test 2 **************** */
  test('Launch STDCM simulation with all stops', async () => {
    // Populate STDCM page with origin, destination, and via details, then verify
    await stdcmPage.fillAndVerifyConsistDetails(
      consistDetails,
      tractionEnginePrefilledValues.tonnage,
      tractionEnginePrefilledValues.length
    );
    await stdcmPage.fillAndVerifyOriginDetails();
    await stdcmPage.fillAndVerifyDestinationDetails();
    const viaDetails = [
      { viaNumber: 1, ciSearchText: 'mid_west' },
      { viaNumber: 2, ciSearchText: 'mid_east' },
      { viaNumber: 3, ciSearchText: 'nS' },
    ];

    for (const viaDetail of viaDetails) {
      await stdcmPage.fillAndVerifyViaDetails(viaDetail);
    }
    // Launch simulation and verify output data matches expected results
    await stdcmPage.launchSimulation();
    await simulationResultPage.verifyTableData('./tests/assets/stdcm/stdcm-all-stops.json');
  });

  /** *************** Test 3 **************** */
  test('Launch simulation with and without capacity for towed rolling stock', async () => {
    const towedConsistDetails: ConsistFields = {
      tractionEngine: fastRollingStockName,
      towedRollingStock: createdTowedRollingStock.name,
    };

    await stdcmPage.fillAndVerifyConsistDetails(
      towedConsistDetails,
      fastRollingStockPrefilledValues.tonnage,
      fastRollingStockPrefilledValues.length,
      towedRollingStockPrefilledValues.tonnage,
      towedRollingStockPrefilledValues.length
    );
    await stdcmPage.fillOriginDetailsLight();
    await stdcmPage.fillDestinationDetailsLight();
    await stdcmPage.fillAndVerifyViaDetails({
      viaNumber: 1,
      ciSearchText: 'mid_west',
    });
    // Run first simulation without capacity
    await stdcmPage.launchSimulation();
    await stdcmPage.verifySimulationDetails({
      simulationNumber: 1,
    });
    // Update tonnage and launch a second simulation with capacity
    await handleAndVerifyInput(stdcmPage.dateOriginArrival, UPDATED_ORIGIN_ARRIVAL_DATE);
    await stdcmPage.launchSimulation();
    await stdcmPage.verifySimulationDetails({
      simulationNumber: 2,
      simulationLengthAndDuration: '51 km — 2h 35min',
    });
    await simulationResultPage.verifyTableData(
      './tests/assets/stdcm/towed-rolling-stock/towed-rolling-stock-table-result.json'
    );
  });
});
