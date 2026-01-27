import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import { fastRollingStockName } from './../assets/constants/project-const';
import test, { createStdcmTab } from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra, setTowedRollingStock } from './../utils/api-utils';
import type { ConsistFields } from './../utils/types';
import { DEFAULT_DETAILS } from '../assets/constants/stdcm-const';

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

test.describe('@stdcm @stdcm-linked-train', () => {
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
    await page.goto('/stdcm');
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test('Verify STDCM anterior linked train', async ({
    page,
    consistSection,
    linkedTrainSection,
    destinationSection,
    viaSection,
    stdcmPage,
    stdcmSimulationResultPage,
  }, testInfo) => {
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
      await stdcmSimulationResultPage.verifyTableData(
        './tests/assets/stdcm/linked-train/anterior-linked-train-table.json'
      );
    });

    await test.step('Retain + download simulation PDF', async () => {
      await stdcmSimulationResultPage.retainSimulation();
      await stdcmSimulationResultPage.downloadSimulation(testInfo.outputDir);
    });

    await test.step('Start new query with data', async () => {
      const [newPage] = await Promise.all([
        page.context().waitForEvent('page'),
        stdcmSimulationResultPage.startNewQueryWithData(),
      ]);

      await newPage.bringToFront();
      await newPage.waitForLoadState('domcontentloaded');

      const {
        consistSection: newConsistSection,
        originSection: newOriginSection,
        viaSection: newViaSection,
        destinationSection: newDestinationSection,
      } = createStdcmTab(newPage);
      await newConsistSection.verifyConsistDetails({
        tractionEngine: fastRollingStockName,
        towedRollingStock: createdTowedRollingStock.name,
        tonnage: `${Number(fastRollingStockPrefilledValues.tonnage) + Number(towedRollingStockPrefilledValues.tonnage)}`,
        length: `${Number(towedRollingStockPrefilledValues.length) + Number(fastRollingStockPrefilledValues.length)}`,
        maxSpeed: DEFAULT_DETAILS.maxSpeed,
        speedLimitTag: DEFAULT_DETAILS.speedLimitTag,
      });
      await newOriginSection.verifyOriginDetails();
      await newDestinationSection.verifyDestinationDetails();
      await newViaSection.verifyViaDetails();
    });
  });

  /** *************** Test 2 **************** */
  test('Verify STDCM posterior linked train', async ({
    originSection,
    consistSection,
    linkedTrainSection,
    viaSection,
    stdcmPage,
    stdcmSimulationResultPage,
  }, testInfo) => {
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
      await stdcmSimulationResultPage.verifyTableData(
        './tests/assets/stdcm/linked-train/posterior-linked-train-table.json'
      );
    });

    await test.step('Retain + download simulation PDF', async () => {
      await stdcmSimulationResultPage.retainSimulation();
      await stdcmSimulationResultPage.downloadSimulation(testInfo.outputDir);
    });
  });
});
