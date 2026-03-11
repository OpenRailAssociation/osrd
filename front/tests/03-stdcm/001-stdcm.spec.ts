import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import { fastRollingStockName } from './../assets/constants/project-const';
import test, { createStdcmTab } from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra, setTowedRollingStock } from './../utils/api-utils';
import type { ConsistFields } from './../utils/types';
import {
  ALL_STOPS_TABLE_DATA_PATH,
  ALTERNATIVE_SIMULATION_RESULTS_DETAILS,
  CONFLICT_ARRIVAL_TIME,
  CONSIST_DETAILS,
  FAST_ROLLING_STOCK_PREFILLED_VALUES,
  SIMULATION_RESULTS_WITH_STOPS_DETAILS,
  STDCM_URL,
  TOWED_ROLLING_STOCK_PREFILLED_VALUES,
  TOWED_ROLLING_STOCK_TABLE_DATA_PATH,
  TRACTION_ENGINE_PREFILLED_VALUES,
  VIA_DETAILS,
} from '../assets/constants/stdcm/stdcm-const';

test.describe('@stdcm', () => {
  let infra: Infra;
  let createdTowedRollingStock: TowedRollingStock;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
    createdTowedRollingStock = await setTowedRollingStock();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto(STDCM_URL);
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('@smoke Verify default STDCM page', async ({
    stdcmPage,
    consistSection,
    originSection,
    viaSection,
    destinationSection,
    linkedTrainSection,
  }) => {
    await test.step('Verify base UI sections are visible', async () => {
      await stdcmPage.verifyStdcmElementsVisibility();
    });

    await test.step('Verify default input values', async () => {
      await consistSection.verifyDefaultConsistFields();
      await originSection.verifyDefaultOriginFields();
      await destinationSection.verifyDefaultDestinationFields();
    });

    await test.step('Add/delete default via and linked path', async () => {
      await viaSection.addAndDeletedDefaultVia();
      await linkedTrainSection.addAndDeleteDefaultLinkedPath();
    });
  });

  /** *************** Test 2 **************** */
  test('@smoke Launch STDCM simulation with all stops', async ({
    page,
    consistSection,
    originSection,
    destinationSection,
    viaSection,
    stdcmPage,
    stdcmSimulationResultPage,
  }) => {
    await test.step('Fill consist, origin and destination', async () => {
      await consistSection.fillAndVerifyConsistDetails(
        CONSIST_DETAILS,
        TRACTION_ENGINE_PREFILLED_VALUES.tonnage,
        TRACTION_ENGINE_PREFILLED_VALUES.length
      );
      await originSection.fillAndVerifyOriginDetails();
      await destinationSection.fillAndVerifyDestinationDetails();
    });

    await test.step('Fill three vias and verify each', async () => {
      for (const viaDetail of VIA_DETAILS) {
        await viaSection.fillAndVerifyViaDetails(viaDetail);
      }
    });

    await test.step('Launch simulation and verify results table', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmSimulationResultPage.verifySimulationDetails(
        SIMULATION_RESULTS_WITH_STOPS_DETAILS
      );
      await stdcmSimulationResultPage.verifyTableData(ALL_STOPS_TABLE_DATA_PATH);
    });

    await test.step('Retain simulation and start new query without data', async () => {
      await stdcmSimulationResultPage.retainSimulation();

      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        stdcmSimulationResultPage.startNewQueryWithoutData(),
      ]);
      await newPage.bringToFront();
      await newPage.waitForLoadState('domcontentloaded');
      const {
        consistSection: newConsistSection,
        originSection: newOriginSection,
        destinationSection: newDestinationSection,
      } = createStdcmTab(newPage);

      await newConsistSection.verifyDefaultConsistFields();
      await newOriginSection.verifyDefaultOriginFields();
      await newDestinationSection.verifyDefaultDestinationFields();
    });
  });

  /** *************** Test 3 **************** */
  test('Launch simulation with and without capacity for towed rolling stock', async ({
    consistSection,
    originSection,
    destinationSection,
    viaSection,
    stdcmPage,
    stdcmSimulationResultPage,
  }) => {
    const towedConsistDetails: ConsistFields = {
      tractionEngine: fastRollingStockName,
      towedRollingStock: createdTowedRollingStock.name,
    };

    await test.step('Fill consist section with towed RS and route', async () => {
      await consistSection.fillAndVerifyConsistDetails(
        towedConsistDetails,
        FAST_ROLLING_STOCK_PREFILLED_VALUES.tonnage,
        FAST_ROLLING_STOCK_PREFILLED_VALUES.length,
        TOWED_ROLLING_STOCK_PREFILLED_VALUES.tonnage,
        TOWED_ROLLING_STOCK_PREFILLED_VALUES.length
      );
      await originSection.fillOriginDetailsLight(CONFLICT_ARRIVAL_TIME);
      await destinationSection.fillDestinationDetailsLight();
      await viaSection.fillAndVerifyViaDetails({ viaNumber: 1, ciSearchText: 'mid_west' });
    });

    await test.step('Launch simulation (expect alternative simulations triggered)', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
    });

    await test.step('Initial simulation result is "No capacity"', async () => {
      await stdcmSimulationResultPage.verifySimulationDetails({ simulationIndex: 0 });
    });

    await test.step('First alternative simulation is VALID (51 km — 2h 35min) and verify details', async () => {
      await stdcmSimulationResultPage.verifySimulationDetails(
        ALTERNATIVE_SIMULATION_RESULTS_DETAILS
      );
      await stdcmSimulationResultPage.verifyTableData(TOWED_ROLLING_STOCK_TABLE_DATA_PATH);
    });

    await test.step('Second alternative simulation result is "No capacity"', async () => {
      await stdcmSimulationResultPage.verifySimulationDetails({ simulationIndex: 2 });
    });
  });
});
