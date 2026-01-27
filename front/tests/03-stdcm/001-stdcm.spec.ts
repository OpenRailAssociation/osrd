import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import {
  electricRollingStockName,
  fastRollingStockName,
} from './../assets/constants/project-const';
import { CONFLICT_ARRIVAL_TIME } from './../assets/constants/stdcm-const';
import test, { createStdcmTab } from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra, setTowedRollingStock } from './../utils/api-utils';
import type { ConsistFields } from './../utils/types';

const consistDetails: ConsistFields = {
  tractionEngine: electricRollingStockName,
  tonnage: '950',
  length: '567',
  speedLimitTag: 'HLP',
};
const tractionEnginePrefilledValues = { tonnage: '900', length: '400' };
const fastRollingStockPrefilledValues = { tonnage: '190', length: '46' };
const towedRollingStockPrefilledValues = { tonnage: '46', length: '26' };

test.describe('@stdcm', () => {
  let infra: Infra;
  let createdTowedRollingStock: TowedRollingStock;

  test.beforeAll('Fetch infrastructure', async () => {
    infra = await getInfra();
    createdTowedRollingStock = await setTowedRollingStock();
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto('/stdcm');
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
        consistDetails,
        tractionEnginePrefilledValues.tonnage,
        tractionEnginePrefilledValues.length
      );
      await originSection.fillAndVerifyOriginDetails();
      await destinationSection.fillAndVerifyDestinationDetails();
    });

    await test.step('Fill three vias and verify each', async () => {
      const viaDetails = [
        { viaNumber: 1, ciSearchText: 'mid_west' },
        { viaNumber: 2, ciSearchText: 'mid_east' },
        { viaNumber: 3, ciSearchText: 'nS' },
      ];
      for (const viaDetail of viaDetails) {
        await viaSection.fillAndVerifyViaDetails(viaDetail);
      }
    });

    await test.step('Launch simulation and verify results table', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmSimulationResultPage.verifySimulationDetails({
        simulationIndex: 0,
        simulationLengthAndDuration: '51 km — 1h 17min',
        validSimulationNumber: 1,
      });
      await stdcmSimulationResultPage.verifyTableData('./tests/assets/stdcm/stdcm-all-stops.json');
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
        fastRollingStockPrefilledValues.tonnage,
        fastRollingStockPrefilledValues.length,
        towedRollingStockPrefilledValues.tonnage,
        towedRollingStockPrefilledValues.length
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
      await stdcmSimulationResultPage.verifySimulationDetails({
        simulationIndex: 1,
        simulationLengthAndDuration: '51 km — 2h 35min',
        validSimulationNumber: 1,
      });
      await stdcmSimulationResultPage.verifyTableData(
        './tests/assets/stdcm/towed-rolling-stock/towed-rolling-stock-table-result.json'
      );
    });

    await test.step('Second alternative simulation result is "No capacity"', async () => {
      await stdcmSimulationResultPage.verifySimulationDetails({ simulationIndex: 2 });
    });
  });
});
