import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import { fastRollingStockName } from './../assets/constants/project-const';
import test, { createStdcmTab } from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra, setTowedRollingStock } from './../utils/api-utils';
import LINKED_TRAIN_DETAILS from '../assets/constants/stdcm/linked-train-const';
import {
  ANTERIOR_LINKED_TRAIN_TABLE_DATA_PATH,
  CI_SUGGESTIONS,
  DEFAULT_DETAILS,
  DESTINATION_DETAILS,
  FAST_ROLLING_STOCK_PREFILLED_VALUES,
  LIGHT_DESTINATION_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  ORIGIN_DETAILS,
  POSTERIOR_LINKED_TRAIN_TABLE_DATA_PATH,
  STDCM_URL,
  TOWED_ROLLING_STOCK_PREFILLED_VALUES,
} from '../assets/constants/stdcm/stdcm-const';
import type { ConsistFields } from '../utils/stdcm-types';

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
    await page.goto(STDCM_URL);
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
      await consistSection.fillAndVerifyConsistDetails({
        consistFields: towedConsistDetails,
        defaultMaxSpeed: DEFAULT_DETAILS.maxSpeed,
        tractionEnginePrefilledValues: {
          expectedTonnage: FAST_ROLLING_STOCK_PREFILLED_VALUES.tonnage,
          expectedLength: FAST_ROLLING_STOCK_PREFILLED_VALUES.length,
        },
        towedRollingStockPrefilledValues: {
          tonnage: TOWED_ROLLING_STOCK_PREFILLED_VALUES.tonnage,
          length: TOWED_ROLLING_STOCK_PREFILLED_VALUES.length,
        },
      });
    });

    await test.step('Configure anterior linked path, destinations and vias', async () => {
      await linkedTrainSection.anteriorLinkedPathDetails();
      await destinationSection.fillDestinationDetailsLight({
        destinationDetails: {
          ...LIGHT_DESTINATION_DETAILS,
          expectedCiValue: CI_SUGGESTIONS.south[1],
        },
        southSuggestions: CI_SUGGESTIONS.south,
        suggestionText: CI_SUGGESTIONS.south[1],
      });
      await viaSection.fillAndVerifyViaDetails({ viaNumber: 1, ciSearchText: 'nS' });
      await destinationSection.fillDestinationDetailsLight();
    });

    await test.step('Launch simulation and verify outputs', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmSimulationResultPage.verifyTableData(
        './tests/assets/stdcm/linked-train/anterior-linked-train-table.json'
      );
      await stdcmSimulationResultPage.verifyTableData(ANTERIOR_LINKED_TRAIN_TABLE_DATA_PATH);
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
        tonnage: `${Number(FAST_ROLLING_STOCK_PREFILLED_VALUES.tonnage) + Number(TOWED_ROLLING_STOCK_PREFILLED_VALUES.tonnage)}`,
        length: `${Number(TOWED_ROLLING_STOCK_PREFILLED_VALUES.length) + Number(FAST_ROLLING_STOCK_PREFILLED_VALUES.length)}`,
        maxSpeed: DEFAULT_DETAILS.maxSpeed,
        speedLimitTag: DEFAULT_DETAILS.speedLimitTag,
      });

      await newOriginSection.verifyOriginDetails({
        originCi: LINKED_TRAIN_DETAILS.anterior.originCi,
        originCh: LINKED_TRAIN_DETAILS.anterior.originCh,
        originArrival: LINKED_TRAIN_DETAILS.anterior.originArrival,
        dateOriginArrival: LINKED_TRAIN_DETAILS.anterior.dateOriginArrival,
        timeOriginArrival: LINKED_TRAIN_DETAILS.anterior.timeOriginArrival,
        toleranceOriginArrival: `${LINKED_TRAIN_DETAILS.anterior.toleranceFields.min}/${LINKED_TRAIN_DETAILS.anterior.toleranceFields.max}`,
      });

      await newDestinationSection.verifyDestinationDetails({
        expectedCiValue: CI_SUGGESTIONS.south[1],
        chValue: DESTINATION_DETAILS.chValue,
        updatedArrivalType: DESTINATION_DETAILS.arrivalType.default,
      });
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
      await originSection.fillOriginDetailsLight({
        originDetails: {
          ...LIGHT_ORIGIN_DETAILS,
          suggestionText: CI_SUGGESTIONS.north[2],
        },
        expectedSuggestions: CI_SUGGESTIONS.north,
        expectedCiValue: CI_SUGGESTIONS.north[2],
        arrivalTypeOverride: ORIGIN_DETAILS.arrivalType.updated,
        isPrecise: true,
      });
      await linkedTrainSection.posteriorLinkedPathDetails();
      await viaSection.fillAndVerifyViaDetails({ viaNumber: 1, ciSearchText: 'mid_east' });
    });

    await test.step('Fill consist with traction engine details + towed RS and verify prefilled values', async () => {
      await consistSection.fillAndVerifyConsistDetails({
        consistFields: towedConsistDetails,
        defaultMaxSpeed: DEFAULT_DETAILS.maxSpeed,
        tractionEnginePrefilledValues: {
          expectedTonnage: FAST_ROLLING_STOCK_PREFILLED_VALUES.tonnage,
          expectedLength: FAST_ROLLING_STOCK_PREFILLED_VALUES.length,
        },
        towedRollingStockPrefilledValues: {
          tonnage: TOWED_ROLLING_STOCK_PREFILLED_VALUES.tonnage,
          length: TOWED_ROLLING_STOCK_PREFILLED_VALUES.length,
        },
      });
    });

    await test.step('Launch simulation and verify outputs', async () => {
      await stdcmPage.verifyValidSimulationLaunch();
      await stdcmSimulationResultPage.verifyTableData(
        './tests/assets/stdcm/linked-train/posterior-linked-train-table.json'
      );
      await stdcmSimulationResultPage.verifyTableData(POSTERIOR_LINKED_TRAIN_TABLE_DATA_PATH);
    });

    await test.step('Retain + download simulation PDF', async () => {
      await stdcmSimulationResultPage.retainSimulation();
      await stdcmSimulationResultPage.downloadSimulation(testInfo.outputDir);
    });
  });
});
