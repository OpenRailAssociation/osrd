import {
  COMPUTED_THEORETICAL_MARGIN_DEPARTURE,
  DAY_CHANGE_LABEL,
  EXPECTED_COLUMN_COUNT,
  EXPECTED_POWER_RESTRICTION_OPTIONS,
  EXPECTED_ROW_COUNT,
  MARGINS_DIFFERENCE_DEPARTURE,
  MARGINS_DIFFERENCE_VIA_B,
  POWER_RESTRICTION_C1,
  REAL_MARGIN_DEPARTURE,
  REQUESTED_MARGIN_DEPARTURE,
  ROW_INDEX_ORIGIN,
  ROW_INDEX_DESTINATION,
  ROW_INDEX_DISPLAY_ORDER,
  ROW_INDEX_VIA_A,
  ROW_INDEX_VIA_B,
  ROW_INDEX_WAYPOINT,
  SCENARIO_NAME_PREFIX,
  STATUS_CLASSES,
  STOP_DURATION_NONE,
  STOP_DURATION_VIA_A,
  STOP_DURATION_VIA_B,
  TRACK_NAME_ORIGIN,
  myTrain,
} from '../../assets/operation-studies/simulation-result/times-stops-table-const';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';

test.describe('Times Stops Table — Display', { tag: ['@op', '@times-stops'] }, () => {
  setupScenarioFixture({
    scenarioNamePrefix: SCENARIO_NAME_PREFIX,
    trains: myTrain,
  });

  test.beforeEach('Wait for the times-stops table', async ({ scenarioTimetableSection }) => {
    await scenarioTimetableSection.enableOnlyTimesStopsTable();
    await scenarioTimetableSection.verifyTimesStopsDataSheetVisibility();
  });

  /** *************** Test 1 **************** */
  test('Display structure and stop data', async ({ timesStopsTablePage }) => {
    const departureRow = timesStopsTablePage.getRow(ROW_INDEX_ORIGIN);
    const via1Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_A);
    const waypointRow = timesStopsTablePage.getRow(ROW_INDEX_WAYPOINT);
    const via2Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_B);
    const destRow = timesStopsTablePage.getRow(ROW_INDEX_DESTINATION);

    await test.step(`Verify ${EXPECTED_ROW_COUNT} data rows and at least one date-separator row`, async () => {
      await timesStopsTablePage.verifyDataRowCount(EXPECTED_ROW_COUNT);
      await timesStopsTablePage.verifyDateSeparatorVisible();
      await timesStopsTablePage.verifyDateSeparatorText(DAY_CHANGE_LABEL);
    });

    await test.step('Verify non-empty station names on all rows', async () => {
      await Promise.all(
        [departureRow, via1Row, waypointRow, via2Row, destRow].map((row) =>
          timesStopsTablePage.verifyOpFullNameNotEmpty(row)
        )
      );
    });

    await test.step(`Verify sequential row index numbers 1 to ${EXPECTED_ROW_COUNT}`, async () => {
      await Promise.all(
        ROW_INDEX_DISPLAY_ORDER.map(([rowIndex, displayText]) =>
          timesStopsTablePage.verifyRowIndexText(timesStopsTablePage.getRow(rowIndex), displayText)
        )
      );
    });

    await test.step('Verify stop durations ', async () => {
      await timesStopsTablePage.verifyStopDuration(via1Row, STOP_DURATION_VIA_A);
      await timesStopsTablePage.verifyStopDuration(via2Row, STOP_DURATION_VIA_B);
      await timesStopsTablePage.verifyStopDuration(destRow, STOP_DURATION_NONE);
    });

    await test.step('Verify signal checkboxes are checked for via 1', async () => {
      await timesStopsTablePage.verifyShortSlipDistance(via1Row, true);
      await timesStopsTablePage.verifySignalReceptionClosed(via1Row, true);
      await timesStopsTablePage.verifyShortSlipEnabled(via1Row, true);
    });

    await test.step('Verify signal checkboxes are unchecked for via 2 and departure row (OPEN signal)', async () => {
      await timesStopsTablePage.verifyShortSlipDistance(via2Row, false);
      await timesStopsTablePage.verifySignalReceptionClosed(via2Row, false);
      await timesStopsTablePage.verifyShortSlipDistance(departureRow, false);
      await timesStopsTablePage.verifySignalReceptionClosed(departureRow, false);
    });

    await test.step(`Verify all ${EXPECTED_COLUMN_COUNT} columns are present on a data row`, async () => {
      await timesStopsTablePage.verifyColumnCount(departureRow, EXPECTED_COLUMN_COUNT);
    });

    await test.step('Verify computed cells are read-only', async () => {
      for (const row of [departureRow, via1Row]) {
        await timesStopsTablePage.verifyComputedArrivalIsReadOnly(row);
      }
      await timesStopsTablePage.verifyComputedDepartureIsReadOnly(via2Row);
    });

    await test.step('Verify computed departure shows empty-dot marker on rows without a stop', async () => {
      await timesStopsTablePage.verifyComputedDepartureIsEmpty(departureRow);
      await timesStopsTablePage.verifyComputedDepartureIsEmpty(waypointRow);
    });

    await test.step('Verify op-name dot visible on explicit path-step rows, absent on intermediate waypoint', async () => {
      await timesStopsTablePage.verifyOpNameDotVisible(departureRow);
      await timesStopsTablePage.verifyOpNameDotAbsent(waypointRow);
    });

    await test.step('Verify track dot only on path-step rows whose track was requested', async () => {
      await timesStopsTablePage.verifyTrackNameDotVisible(departureRow);
      await timesStopsTablePage.verifyTrackNameDotVisible(via1Row);
      await timesStopsTablePage.verifyTrackName(departureRow, TRACK_NAME_ORIGIN);
      await timesStopsTablePage.verifyTrackNameDotAbsent(via2Row);
      await timesStopsTablePage.verifyTrackNameDotAbsent(destRow);
      await timesStopsTablePage.verifyTrackNameDotAbsent(waypointRow);
    });
  });

  /** *************** Test 2 **************** */
  test('Power restrictions and margins', async ({ timesStopsTablePage }) => {
    const departureRow = timesStopsTablePage.getRow(ROW_INDEX_ORIGIN);
    const via1Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_A);
    const waypointRow = timesStopsTablePage.getRow(ROW_INDEX_WAYPOINT);
    const via2Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_B);
    const destRow = timesStopsTablePage.getRow(ROW_INDEX_DESTINATION);

    await test.step('Verify power restriction combobox is visible on all rows with correct initial values', async () => {
      for (const row of [departureRow, via1Row, waypointRow]) {
        await timesStopsTablePage.verifyPowerRestriction(row, '');
      }
      await timesStopsTablePage.verifyPowerRestriction(via2Row, POWER_RESTRICTION_C1);
      await timesStopsTablePage.verifyPowerRestriction(destRow, POWER_RESTRICTION_C1);
    });

    await test.step(`Verify computed theoretical margin shows ${COMPUTED_THEORETICAL_MARGIN_DEPARTURE} on departure row and is absent on intermediate rows`, async () => {
      await timesStopsTablePage.verifyComputedTheoreticalMarginText(
        departureRow,
        COMPUTED_THEORETICAL_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyComputedTheoreticalMarginAbsent(via1Row);
    });

    await test.step('Verify real margin on departure row and absence on intermediate rows', async () => {
      await timesStopsTablePage.verifyRealMarginText(departureRow, REAL_MARGIN_DEPARTURE);
      await timesStopsTablePage.verifyRealMarginAbsent(via1Row);
    });

    await test.step(`Verify requested theoretical margin shows ${REQUESTED_MARGIN_DEPARTURE} on departure and is empty on via rows`, async () => {
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(via1Row, '');
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        departureRow,
        REQUESTED_MARGIN_DEPARTURE
      );
    });

    await test.step('Verify the power restriction selector offers the rolling stock codes plus the empty set symbol', async () => {
      await timesStopsTablePage.verifyPowerRestrictionOptions(
        via1Row,
        EXPECTED_POWER_RESTRICTION_OPTIONS
      );
    });

    await test.step(`Verify margins difference shows ${MARGINS_DIFFERENCE_DEPARTURE} on the departure row and ${MARGINS_DIFFERENCE_VIA_B} on via 2`, async () => {
      await timesStopsTablePage.verifyMarginsDifferenceText(
        departureRow,
        MARGINS_DIFFERENCE_DEPARTURE
      );
      await timesStopsTablePage.verifyMarginsDifferenceText(via2Row, MARGINS_DIFFERENCE_VIA_B);
    });

    await test.step('Verify computed theoretical margin and real margin present on via 2 row (has requested arrival)', async () => {
      await timesStopsTablePage.verifyComputedTheoreticalMarginPresent(via2Row);
      await timesStopsTablePage.verifyRealMarginPresent(via2Row);
    });
  });

  /** *************** Test 3 **************** */
  test('+ placeholder visibility in editable cells', async ({ timesStopsTablePage }) => {
    const departureRow = timesStopsTablePage.getRow(ROW_INDEX_ORIGIN);
    const via1Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_A);
    const via2Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_B);
    const waypointRow = timesStopsTablePage.getRow(ROW_INDEX_WAYPOINT);

    await test.step('Empty requested arrival and departure show +', async () => {
      await timesStopsTablePage.verifyArrivalPlaceholderVisible(via1Row);
      await timesStopsTablePage.verifyDeparturePlaceholderVisible(via1Row);
    });

    await test.step('Empty stop duration shows +', async () => {
      await timesStopsTablePage.verifyDurationPlaceholderVisible(waypointRow);
      await timesStopsTablePage.verifyDurationPlaceholderVisible(departureRow);
    });

    await test.step('Filled cells show no +', async () => {
      await timesStopsTablePage.verifyArrivalPlaceholderHidden(via2Row);
      await timesStopsTablePage.verifyDeparturePlaceholderHidden(via2Row);
      await timesStopsTablePage.verifyDurationPlaceholderHidden(via2Row);
    });
  });

  /** *************** Test 4 **************** */
  test('Row status indicators', async ({ timesStopsTablePage }) => {
    const departureRow = timesStopsTablePage.getRow(ROW_INDEX_ORIGIN);
    const via1Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_A);
    const via2Row = timesStopsTablePage.getRow(ROW_INDEX_VIA_B);
    const waypointRow = timesStopsTablePage.getRow(ROW_INDEX_WAYPOINT);
    const destRow = timesStopsTablePage.getRow(ROW_INDEX_DESTINATION);

    await test.step('Verify departure row has success-schedule status', async () => {
      await timesStopsTablePage.verifyRowStatus(departureRow, STATUS_CLASSES.SUCCESS_SCHEDULE);
    });

    await test.step('Verify via 1 row has no status class (no requested arrival)', async () => {
      await timesStopsTablePage.verifyRowStatusNeutral(via1Row);
    });

    await test.step('Verify via 2 row with requested arrival shows a schedule status', async () =>
      await timesStopsTablePage.verifyRowStatus(via2Row, STATUS_CLASSES.WARNING_MARGIN));

    await test.step('Waypoint row (no schedule, no simulation) has neutral status', async () => {
      await timesStopsTablePage.verifyRowStatusNeutral(waypointRow);
    });

    await test.step('Destination row has a schedule status (has requested arrival constraint)', async () => {
      await timesStopsTablePage.verifyRowStatus(destRow, STATUS_CLASSES.WARNING_SCHEDULE);
    });
  });
});
