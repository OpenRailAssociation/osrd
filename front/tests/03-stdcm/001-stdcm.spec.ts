import type { Infra, TowedRollingStock } from 'common/api/osrdEditoastApi';

import {
  ALL_STOPS_TABLE_DATA_PATH,
  ALTERNATIVE_SIMULATION_RESULTS_DETAILS,
  CI_SUGGESTIONS,
  CONFLICT_ARRIVAL_TIME,
  CONSIST_DETAILS,
  DEFAULT_DETAILS,
  DESTINATION_DETAILS,
  FAST_ROLLING_STOCK_PREFILLED_VALUES,
  LIGHT_DESTINATION_DETAILS,
  LIGHT_ORIGIN_DETAILS,
  ORIGIN_DETAILS,
  SIMULATION_RESULTS_WITH_STOPS_DETAILS,
  STDCM_TRANSLATIONS,
  STDCM_URL,
  TOWED_ROLLING_STOCK_PREFILLED_VALUES,
  TOWED_ROLLING_STOCK_TABLE_DATA_PATH,
  TRACTION_ENGINE_PREFILLED_VALUES,
  VIA_DETAILS,
  VIA_STOP_TIMES,
  VIA_STOP_TYPES,
  VIA_SUGGESTIONS,
} from '../assets/constants/stdcm/stdcm-const';
import type { ConsistFields } from '../utils/stdcm-types';
import { fastRollingStockName } from './../assets/constants/project-const';
import test, { createStdcmTab } from './../page-object-fixture';
import { waitForInfraStateToBeCached } from './../utils';
import { getInfra, setTowedRollingStock } from './../utils/api-utils';

test.describe('STDCM simulation with all stops and towed rolling stock', { tag: '@stdcm' }, () => {
  let infra: Infra;
  let createdTowedRollingStock: TowedRollingStock;

  test.beforeAll('Fetch infrastructure', async () => {
    [infra, createdTowedRollingStock] = await Promise.all([getInfra(), setTowedRollingStock()]);
  });

  test.beforeEach('Navigate to the STDCM page', async ({ page }) => {
    await page.goto(STDCM_URL);
    await waitForInfraStateToBeCached(infra.id);
  });

  /** *************** Test 1 **************** */
  test(
    ' Verify default STDCM page',
    { tag: '@smoke' },
    async ({
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
        await consistSection.verifyDefaultConsistFields({
          defaultSpeedLimitTag: DEFAULT_DETAILS.speedLimitTag,
        });

        await originSection.verifyDefaultOriginFields({
          arrivalType: ORIGIN_DETAILS.arrivalType.default,
          arrivalDate: DEFAULT_DETAILS.arrivalDate,
          arrivalTime: DEFAULT_DETAILS.arrivalTime,
          tolerance: DEFAULT_DETAILS.tolerance,
        });

        await destinationSection.verifyDefaultDestinationFields(
          DESTINATION_DETAILS.arrivalType.default
        );
      });

      await test.step('Add/delete default via and linked path', async () => {
        await viaSection.addAndDeletedDefaultVia(VIA_STOP_TYPES.PASSAGE_TIME);
        await linkedTrainSection.addAndDeleteDefaultLinkedPath({
          defaultDate: DEFAULT_DETAILS.arrivalDate,
        });
      });
    }
  );

  /** *************** Test 2 **************** */
  test(
    'Launch STDCM simulation with all stops',
    { tag: '@smoke' },
    async ({
      page,
      consistSection,
      originSection,
      destinationSection,
      viaSection,
      stdcmPage,
      stdcmSimulationResultPage,
    }) => {
      await test.step('Fill consist, origin and destination', async () => {
        await consistSection.fillAndVerifyConsistDetails({
          consistFields: CONSIST_DETAILS,
          defaultMaxSpeed: DEFAULT_DETAILS.maxSpeed,
          tractionEnginePrefilledValues: {
            expectedTonnage: TRACTION_ENGINE_PREFILLED_VALUES.tonnage,
            expectedLength: TRACTION_ENGINE_PREFILLED_VALUES.length,
          },
        });

        await originSection.fillAndVerifyOriginDetails({
          input: ORIGIN_DETAILS.input,
          expectedCiValue: ORIGIN_DETAILS.suggestion,
          suggestionText: CI_SUGGESTIONS.north[2],
          expectedSuggestions: CI_SUGGESTIONS.north,
          chValue: ORIGIN_DETAILS.chValue,
          arrivalDate: ORIGIN_DETAILS.arrivalDate,
          arrivalTime: ORIGIN_DETAILS.arrivalTime,
          tolerance: ORIGIN_DETAILS.tolerance,
          updatedChValue: ORIGIN_DETAILS.updatedChValue,
          arrivalType: ORIGIN_DETAILS.arrivalType,
        });

        await destinationSection.fillAndVerifyDestinationDetails({
          destinationDetails: {
            ...DESTINATION_DETAILS,
            expectedCiValue: CI_SUGGESTIONS.south[1],
          },
          southSuggestions: CI_SUGGESTIONS.south,
          noScheduledPointMessage: STDCM_TRANSLATIONS.stdcmErrors.routeErrors.noScheduledPoint,
        });
      });

      await test.step('Fill three vias and verify each', async () => {
        for (const viaDetail of VIA_DETAILS) {
          await viaSection.fillAndVerifyViaDetails({
            ...viaDetail,
            expectedChValue: DEFAULT_DETAILS.chValue,
            stopTypes: VIA_STOP_TYPES,
            stopTimes: VIA_STOP_TIMES,
            suggestionTextBySearch: {
              mid_west: VIA_SUGGESTIONS[0],
              mid_east: VIA_SUGGESTIONS[1],
              nS: VIA_SUGGESTIONS[2],
            },
            driverSwitchTooShortWarning:
              STDCM_TRANSLATIONS.stdcmErrors.routeErrors.viaStopDurationDriverSwitchTooShort,
          });
        }
      });

      await test.step('Launch simulation and verify results table', async () => {
        await stdcmPage.verifyValidSimulationLaunch(
          STDCM_TRANSLATIONS.simulation.results.status.completed
        );
        await stdcmSimulationResultPage.verifySimulationDetails({
          ...SIMULATION_RESULTS_WITH_STOPS_DETAILS,
          noOutputSimulationName:
            STDCM_TRANSLATIONS.simulation.results.simulationName.withoutOutputs,
        });
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

        await newConsistSection.verifyDefaultConsistFields({
          defaultSpeedLimitTag: DEFAULT_DETAILS.speedLimitTag,
        });

        await newOriginSection.verifyDefaultOriginFields({
          arrivalType: ORIGIN_DETAILS.arrivalType.default,
          arrivalDate: DEFAULT_DETAILS.arrivalDate,
          arrivalTime: DEFAULT_DETAILS.arrivalTime,
          tolerance: DEFAULT_DETAILS.tolerance,
        });

        await newDestinationSection.verifyDefaultDestinationFields(
          DESTINATION_DETAILS.arrivalType.default
        );
      });
    }
  );

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

      await originSection.fillOriginDetailsLight({
        originDetails: {
          ...LIGHT_ORIGIN_DETAILS,
          suggestionText: CI_SUGGESTIONS.north[2],
        },
        expectedSuggestions: CI_SUGGESTIONS.north,
        expectedCiValue: CI_SUGGESTIONS.north[2],
        arrivalTimeOverride: CONFLICT_ARRIVAL_TIME,
      });

      await destinationSection.fillDestinationDetailsLight({
        destinationDetails: {
          ...LIGHT_DESTINATION_DETAILS,
          expectedCiValue: CI_SUGGESTIONS.south[1],
        },
        southSuggestions: CI_SUGGESTIONS.south,
        suggestionText: CI_SUGGESTIONS.south[1],
      });

      await viaSection.fillAndVerifyViaDetails({
        viaNumber: 1,
        ciSearchText: 'mid_west',
        expectedChValue: DEFAULT_DETAILS.chValue,
        stopTypes: VIA_STOP_TYPES,
        stopTimes: VIA_STOP_TIMES,
        suggestionTextBySearch: {
          mid_west: VIA_SUGGESTIONS[0],
          mid_east: VIA_SUGGESTIONS[1],
          nS: VIA_SUGGESTIONS[2],
        },
        driverSwitchTooShortWarning:
          STDCM_TRANSLATIONS.stdcmErrors.routeErrors.viaStopDurationDriverSwitchTooShort,
      });
    });

    await test.step('Launch simulation (expect alternative simulations triggered)', async () => {
      await stdcmPage.verifyValidSimulationLaunch(
        STDCM_TRANSLATIONS.simulation.results.status.completed
      );
    });

    await test.step('Initial simulation result is "No capacity"', async () => {
      await stdcmSimulationResultPage.verifySimulationDetails({
        simulationIndex: 0,
        noOutputSimulationName: STDCM_TRANSLATIONS.simulation.results.simulationName.withoutOutputs,
      });
    });

    await test.step('First alternative simulation is VALID (51 km — 2h 35min) and verify details', async () => {
      await stdcmSimulationResultPage.verifySimulationDetails({
        ...ALTERNATIVE_SIMULATION_RESULTS_DETAILS,
        noOutputSimulationName: STDCM_TRANSLATIONS.simulation.results.simulationName.withoutOutputs,
      });
      await stdcmSimulationResultPage.verifyTableData(TOWED_ROLLING_STOCK_TABLE_DATA_PATH);
    });

    await test.step('Second alternative simulation result is "No capacity"', async () => {
      await stdcmSimulationResultPage.verifySimulationDetails({
        simulationIndex: 2,
        noOutputSimulationName: STDCM_TRANSLATIONS.simulation.results.simulationName.withoutOutputs,
      });
    });
  });
});
