import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import { fastRollingStockName } from './assets/constants/project-const';
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

test.describe('Verify stdcm simulation page', () => {
  test.slow();
  test.use({ viewport: { width: 1920, height: 1080 } });

  let stdcmPage: STDCMPage;
  let consistSection: ConsistSection;
  let originSection: OriginSection;
  let viaSection: ViaSection;
  let destinationSection: DestinationSection;
  let simulationResultPage: SimulationResultPage;
  let linkedTrainSection: LinkedTrainSection;

  let infra: Infra;
  let createdTowedRollingStock: TowedRollingStock;
  let towedConsistDetails: ConsistFields;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
    createdTowedRollingStock = await setTowedRollingStock();
    towedConsistDetails = {
      tractionEngine: fastRollingStockName,
      towedRollingStock: createdTowedRollingStock.name,
    };
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
    await stdcmPage.removeViteOverlay();
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify STDCM anterior linked train', async ({ page: _ }, testInfo) => {
    await test.step('Fill consist with traction engine details + towed RS and verify prefilled values', async () => {
      await consistSection.fillAndVerifyConsistDetails(
        towedConsistDetails,
        fastRollingStockPrefilledValues.tonnage,
        fastRollingStockPrefilledValues.length,
        towedRollingStockPrefilledValues.tonnage,
        towedRollingStockPrefilledValues.length
      );
    });

    await test.step('Configure anterior linked path, destinations and vias', async () => {
      await linkedTrainSection.anteriorLinkedPathDetails();
      await destinationSection.fillDestinationDetailsLight();
      await viaSection.fillAndVerifyViaDetails({ viaNumber: 1, ciSearchText: 'nS' });
      await destinationSection.fillDestinationDetailsLight();
    });

    await test.step('Launch simulation and verify outputs', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await simulationResultPage.verifyTableData(
        './tests/assets/stdcm/linked-train/anterior-linked-train-table.json'
      );
    });

    await test.step('Retain + download simulation PDF', async () => {
      await simulationResultPage.retainSimulation();
      await simulationResultPage.downloadSimulation(testInfo.outputDir);
    });
  });

  /** *************** Test 2 **************** */
  test('Verify STDCM posterior linked train', async ({ page: _ }, testInfo) => {
    await test.step('Fill origin with posterior constraints and linked path', async () => {
      await originSection.fillOriginDetailsLight(undefined, 'respectDestinationSchedule', true);
      await linkedTrainSection.posteriorLinkedPathDetails();
      await viaSection.fillAndVerifyViaDetails({ viaNumber: 1, ciSearchText: 'mid_east' });
    });

    await test.step('Fill consist with traction engine details + towed RS and verify prefilled values', async () => {
      await consistSection.fillAndVerifyConsistDetails(
        towedConsistDetails,
        fastRollingStockPrefilledValues.tonnage,
        fastRollingStockPrefilledValues.length,
        towedRollingStockPrefilledValues.tonnage,
        towedRollingStockPrefilledValues.length
      );
    });

    await test.step('Launch simulation and verify outputs', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await simulationResultPage.verifyTableData(
        './tests/assets/stdcm/linked-train/posterior-linked-train-table.json'
      );
    });

    await test.step('Retain + download simulation PDF', async () => {
      await simulationResultPage.retainSimulation();
      await simulationResultPage.downloadSimulation(testInfo.outputDir);
    });
  });
});
