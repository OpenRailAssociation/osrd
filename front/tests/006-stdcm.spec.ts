import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import { electricRollingStockName, fastRollingStockName } from './assets/constants/project-const';
import { CONFLICT_ARRIVAL_TIME } from './assets/constants/stdcm-const';
import test from './logging-fixture';
import ConsistSection from './pages/stdcm/consist-section';
import DestinationSection from './pages/stdcm/destination-section';
import LinkedTrainSection from './pages/stdcm/linked-train-section';
import OriginSection from './pages/stdcm/origin-section';
import SimulationResultPage from './pages/stdcm/simulation-results-page';
import STDCMPage from './pages/stdcm/stdcm-page';
import ViaSection from './pages/stdcm/via-section';
import { waitForInfraStateToBeCached } from './utils';
import { getInfra, setTowedRollingStock } from './utils/api-utils';
import type { ConsistFields } from './utils/types';

test.describe('Verify stdcm simulation page', () => {
  test.slow(); // Mark test as slow due to multiple steps
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let consistSection: ConsistSection;
  let originSection: OriginSection;
  let viaSection: ViaSection;
  let destinationSection: DestinationSection;
  let linkedTrainSection: LinkedTrainSection;
  let simulationResultPage: SimulationResultPage;

  let infra: Infra;
  let createdTowedRollingStock: TowedRollingStock;

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
    [
      stdcmPage,
      consistSection,
      originSection,
      viaSection,
      destinationSection,
      simulationResultPage,
      linkedTrainSection,
    ] = [
      new STDCMPage(page),
      new ConsistSection(page),
      new OriginSection(page),
      new ViaSection(page),
      new DestinationSection(page),
      new SimulationResultPage(page),
      new LinkedTrainSection(page),
    ];

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
    await consistSection.verifyDefaultConsistFields();
    await originSection.verifyDefaultOriginFields();
    await destinationSection.verifyDefaultDestinationFields();
    await viaSection.addAndDeletedDefaultVia();
    await linkedTrainSection.addAndDeleteDefaultLinkedPath();
  });

  /** *************** Test 2 **************** */
  test('Launch STDCM simulation with all stops', async () => {
    // Populate STDCM page with origin, destination, and via details, then verify
    await consistSection.fillAndVerifyConsistDetails(
      consistDetails,
      tractionEnginePrefilledValues.tonnage,
      tractionEnginePrefilledValues.length
    );
    await originSection.fillAndVerifyOriginDetails();
    await destinationSection.fillAndVerifyDestinationDetails();
    const viaDetails = [
      { viaNumber: 1, ciSearchText: 'mid_west' },
      { viaNumber: 2, ciSearchText: 'mid_east' },
      { viaNumber: 3, ciSearchText: 'nS' },
    ];

    for (const viaDetail of viaDetails) {
      await viaSection.fillAndVerifyViaDetails(viaDetail);
    }
    // Launch simulation and verify output data matches expected results
    await stdcmPage.verifyValidSimulationLaunch();
    await simulationResultPage.verifyTableData('./tests/assets/stdcm/stdcm-all-stops.json');
  });

  /** *************** Test 3 **************** */
  test('Launch simulation with and without capacity for towed rolling stock', async () => {
    const towedConsistDetails: ConsistFields = {
      tractionEngine: fastRollingStockName,
      towedRollingStock: createdTowedRollingStock.name,
    };

    await consistSection.fillAndVerifyConsistDetails(
      towedConsistDetails,
      fastRollingStockPrefilledValues.tonnage,
      fastRollingStockPrefilledValues.length,
      towedRollingStockPrefilledValues.tonnage,
      towedRollingStockPrefilledValues.length
    );
    await originSection.fillOriginDetailsLight(CONFLICT_ARRIVAL_TIME);
    await destinationSection.fillDestinationDetailsLight();
    await viaSection.fillAndVerifyViaDetails({
      viaNumber: 1,
      ciSearchText: 'mid_west',
    });
    // Run first simulation without capacity
    await stdcmPage.verifyValidSimulationLaunch();
    await simulationResultPage.verifySimulationDetails({
      simulationIndex: 0,
    });
    await simulationResultPage.verifySimulationDetails({
      simulationIndex: 1,
    });
    await simulationResultPage.verifySimulationDetails({
      simulationIndex: 2,
      simulationLengthAndDuration: '51 km — 2h 35min',
      validSimulationNumber: 1,
    });
    await simulationResultPage.verifyTableData(
      './tests/assets/stdcm/towed-rolling-stock/towed-rolling-stock-table-result.json'
    );
  });
});
