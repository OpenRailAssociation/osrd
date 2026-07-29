import {
  EDIT_ARRIVAL_VIA_A,
  EDIT_DEPARTURE_VIA_B,
  EMPTY_TIME_PLACEHOLDER,
  MARGIN_EDIT_DISPLAY,
  MARGIN_EDIT_VALUE,
  MARGIN_MIN_PER_100KM_DISPLAY,
  MARGIN_MIN_PER_100KM_VALUE,
  MARGIN_UNIT_MIN_PER_100KM,
  NO_POWER_RESTRICTION_VALUE,
  REQUESTED_ARRIVAL_VIA_B,
  REQUESTED_DEPARTURE_VIA_B,
  ROW_INDEX_ORIGIN,
  ROW_INDEX_DESTINATION,
  ROW_INDEX_VIA_A,
  ROW_INDEX_VIA_B,
  ROW_INDEX_WAYPOINT,
  SCENARIO_NAME_PREFIX,
  STOP_DURATION_EDIT_DIGITS,
  STOP_DURATION_EDIT_DISPLAY,
  myTrain,
} from '../../assets/operation-studies/simulation-result/times-stops-table-const';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';

test.describe('Times Stops Table — Edits', { tag: ['@op', '@times-stops'] }, () => {
  setupScenarioFixture({
    scenarioNamePrefix: SCENARIO_NAME_PREFIX,
    trains: myTrain,
  });

  test.beforeEach('Wait for the times-stops table', async ({ scenarioTimetableSection }) => {
    await scenarioTimetableSection.enableOnlyTimesStopsTable();
    await scenarioTimetableSection.verifyTimesStopsDataSheetVisibility();
  });

  /** *************** Test 1 **************** */
  test(
    'Arrival and departure persistence',
    { tag: ['@smoke'] },
    async ({ timesStopsTablePage }) => {
      const via1Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_A);
      const via2Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_B);
      const destRow = timesStopsTablePage.getRow(ROW_INDEX_DESTINATION);

      await test.step('Verify initial requested arrival and departure for via 2', async () => {
        await timesStopsTablePage.verifyRequestedArrivalValue(via2Row, REQUESTED_ARRIVAL_VIA_B);
        await timesStopsTablePage.verifyRequestedDepartureValue(via2Row, REQUESTED_DEPARTURE_VIA_B);
      });

      await test.step('Verify via 1 has no initial requested arrival', async () => {
        await timesStopsTablePage.verifyRequestedArrivalValue(via1Row, EMPTY_TIME_PLACEHOLDER);
      });

      await test.step('Edit requested arrival for via 1 and verify simulation recompute', async () => {
        const destinationArrivalBefore = await timesStopsTablePage.getComputedArrivalText(destRow);
        await timesStopsTablePage.editRequestedArrival(via1Row, EDIT_ARRIVAL_VIA_A);
        await timesStopsTablePage.verifyRequestedArrivalValue(via1Row, EDIT_ARRIVAL_VIA_A);
        await timesStopsTablePage.verifyComputedArrivalNotEmpty(via1Row);
        await timesStopsTablePage.waitForSimulation();
        await timesStopsTablePage.verifyComputedArrivalChanged(destRow, destinationArrivalBefore);
      });

      await test.step('Edit requested departure for via 2 and verify computation', async () => {
        const destinationArrivalBefore = await timesStopsTablePage.getComputedArrivalText(destRow);
        await timesStopsTablePage.editRequestedDeparture(via2Row, EDIT_DEPARTURE_VIA_B);
        await timesStopsTablePage.verifyRequestedDepartureValue(via2Row, EDIT_DEPARTURE_VIA_B);
        await timesStopsTablePage.verifyComputedDepartureNotEmpty(via2Row);
        await timesStopsTablePage.waitForSimulation();
        await timesStopsTablePage.verifyComputedArrivalChanged(destRow, destinationArrivalBefore);
      });

      await test.step('Clear requested arrival for via 2 and verify computed arrival remains attached', async () => {
        await timesStopsTablePage.clearRequestedArrival(via2Row);
        await timesStopsTablePage.verifyRequestedArrivalValue(via2Row, EMPTY_TIME_PLACEHOLDER);
        await timesStopsTablePage.verifyComputedArrivalAttached(via2Row);
      });
    }
  );

  /** *************** Test 2 **************** */
  test(
    'Signal closed and short slip dependency',
    { tag: ['@smoke'] },
    async ({ timesStopsTablePage }) => {
      const departureRow = timesStopsTablePage.getRow(ROW_INDEX_ORIGIN);
      const waypointRow = timesStopsTablePage.getRow(ROW_INDEX_WAYPOINT);

      await test.step('Rows without stop duration have both checkboxes disabled', async () => {
        await Promise.all(
          [departureRow, waypointRow].map(async (row) => {
            await timesStopsTablePage.verifySignalReceptionEnabled(row, false);
            await timesStopsTablePage.verifyShortSlipEnabled(row, false);
          })
        );
      });

      await test.step('Add stop duration → signal-closed enabled, short-slip still disabled', async () => {
        const waypointDepartureBefore =
          await timesStopsTablePage.getComputedDepartureText(waypointRow);
        await timesStopsTablePage.editStopDuration(waypointRow, STOP_DURATION_EDIT_DIGITS);
        await timesStopsTablePage.verifyStopDuration(waypointRow, STOP_DURATION_EDIT_DISPLAY);
        await timesStopsTablePage.verifySignalReceptionEnabled(waypointRow, true);
        await timesStopsTablePage.verifyShortSlipEnabled(waypointRow, false);
        await timesStopsTablePage.waitForSimulation();
        await timesStopsTablePage.verifyComputedDepartureChanged(
          waypointRow,
          waypointDepartureBefore
        );
      });

      await test.step('Check signal-closed → short-slip becomes enabled', async () => {
        await timesStopsTablePage.clickSignalReceptionClosed(waypointRow);
        await timesStopsTablePage.verifySignalReceptionClosed(waypointRow, true);
        await timesStopsTablePage.verifyShortSlipEnabled(waypointRow, true);
      });

      await test.step('Check short-slip → it is checked', async () => {
        await timesStopsTablePage.clickShortSlipDistance(waypointRow);
        await timesStopsTablePage.verifyShortSlipDistance(waypointRow, true);
      });

      await test.step('Uncheck signal-closed → short-slip is auto-unchecked and disabled again', async () => {
        await timesStopsTablePage.clickSignalReceptionClosed(waypointRow);
        await timesStopsTablePage.verifySignalReceptionClosed(waypointRow, false);
        await timesStopsTablePage.verifyShortSlipDistance(waypointRow, false);
        await timesStopsTablePage.verifyShortSlipEnabled(waypointRow, false);
      });
    }
  );

  /** *************** Test 3 **************** */
  test(
    'Power restriction selection and clearing',
    { tag: ['@smoke'] },
    async ({ timesStopsTablePage }) => {
      const via1Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_A);

      await test.step('Power restriction combobox has an empty option and the Ø option', async () => {
        await timesStopsTablePage.verifyPowerRestrictionHasOption(via1Row, '', 1);
        await timesStopsTablePage.verifyPowerRestrictionHasOption(
          via1Row,
          NO_POWER_RESTRICTION_VALUE,
          1
        );
      });

      await test.step('Select Ø (no power restriction) → value is set in cell', async () => {
        await timesStopsTablePage.selectPowerRestriction(via1Row, NO_POWER_RESTRICTION_VALUE);
        await timesStopsTablePage.verifyPowerRestriction(via1Row, NO_POWER_RESTRICTION_VALUE);
      });

      await test.step('Wait for simulation after power restriction save', async () => {
        await timesStopsTablePage.waitForSimulation();
      });

      await test.step('Select empty option → restriction is cleared', async () => {
        await timesStopsTablePage.selectPowerRestriction(via1Row, '');
        await timesStopsTablePage.verifyPowerRestriction(via1Row, '');
      });
    }
  );

  /** *************** Test 4 **************** */
  test('Margin cell editing and clearing', { tag: ['@smoke'] }, async ({ timesStopsTablePage }) => {
    const waypointRow = timesStopsTablePage.getRow(ROW_INDEX_WAYPOINT);
    const via2Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_B);

    await test.step('Requested margin cell starts in inherited state (placeholder "+" visible)', async () => {
      await timesStopsTablePage.verifyMarginPlaceholderVisible(waypointRow);
    });

    await test.step(`Set ${MARGIN_EDIT_DISPLAY} margin → value displayed, placeholder hidden`, async () => {
      await timesStopsTablePage.waitForSimulation();
      await timesStopsTablePage.editRequestedMargin(waypointRow, MARGIN_EDIT_VALUE);
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        waypointRow,
        MARGIN_EDIT_DISPLAY
      );
      await timesStopsTablePage.verifyMarginPlaceholderHidden(waypointRow);
      await timesStopsTablePage.waitForSimulation();
    });

    await test.step(`Timed via row inherits the ${MARGIN_EDIT_DISPLAY} margin and displays it in inherited style`, async () => {
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(via2Row, MARGIN_EDIT_DISPLAY);
      await timesStopsTablePage.verifyInheritedMarginStyle(via2Row);
    });

    await test.step(`Switching unit to ${MARGIN_MIN_PER_100KM_DISPLAY} and committing updates the display accordingly`, async () => {
      await timesStopsTablePage.editRequestedMarginWithUnit(
        waypointRow,
        MARGIN_MIN_PER_100KM_VALUE,
        MARGIN_UNIT_MIN_PER_100KM
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        waypointRow,
        MARGIN_MIN_PER_100KM_DISPLAY
      );
      await timesStopsTablePage.waitForSimulation();
    });

    await test.step('Clear margin → cell returns to inherited state with "+" visible', async () => {
      await timesStopsTablePage.clearRequestedMargin(waypointRow);
      await timesStopsTablePage.verifyMarginPlaceholderVisible(waypointRow);
    });
  });
});
