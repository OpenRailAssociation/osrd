import {
  COMPUTED_THEORETICAL_MARGIN_DEPARTURE,
  EXPECTED_COLUMN_COUNT,
  EXPECTED_ROW_COUNT,
  POWER_RESTRICTION_C1,
  REAL_MARGIN_DEPARTURE,
  REQUESTED_MARGIN_DEPARTURE,
  ROW_INDEX_ORIGIN,
  ROW_INDEX_DESTINATION,
  ROW_INDEX_DISPLAY_ORDER,
  ROW_INDEX_VIA_A,
  ROW_INDEX_VIA_B,
  ROW_INDEX_WAYPOINT,
  STATUS_CLASSES,
  STOP_DURATION_NONE,
  STOP_DURATION_VIA_A,
  STOP_DURATION_VIA_B,
} from '../../assets/operation-studies/simulation-result/times-stops-table-const';
import test from '../../page-object-fixture';
import setupScenarioWithTrain from './times-stops-scenario-fixture';

test.describe('Times Stops Table — Display', { tag: ['@op', '@times-stops'] }, () => {
  setupScenarioWithTrain();

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

    await test.step('Verify computed arrival cells contain no editable input', async () => {
      await Promise.all(
        [departureRow, via1Row].map((row) => timesStopsTablePage.verifyComputedArrivalReadOnly(row))
      );
    });

    await test.step('Verify computed departure shows empty-dot marker on rows without a stop', async () => {
      await timesStopsTablePage.verifyComputedDepartureIsEmpty(departureRow);
      await timesStopsTablePage.verifyComputedDepartureIsEmpty(waypointRow);
    });

    await test.step('Verify op-name dot visible on explicit path-step rows, absent on intermediate waypoint', async () => {
      await timesStopsTablePage.verifyOpNameDotVisible(departureRow);
      await timesStopsTablePage.verifyOpNameDotAbsent(waypointRow);
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
      for (const row of [departureRow, via1Row, waypointRow, destRow]) {
        await timesStopsTablePage.verifyPowerRestriction(row, '');
      }
      await timesStopsTablePage.verifyPowerRestriction(via2Row, POWER_RESTRICTION_C1);
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

    await test.step('Verify margins-difference column is rendered on departure row', async () => {
      await timesStopsTablePage.verifyMarginsDifferencePresent(departureRow);
    });

    await test.step('Verify computed theoretical margin and real margin present on via 2 row (has requested arrival)', async () => {
      await timesStopsTablePage.verifyComputedTheoreticalMarginPresent(via2Row);
      await timesStopsTablePage.verifyRealMarginPresent(via2Row);
    });
  });

  /** *************** Test 3 **************** */
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
      await timesStopsTablePage.verifyRowStatus(via1Row, STATUS_CLASSES.NONE);
    });

    await test.step('Verify via 2 row with requested arrival shows a schedule status', async () =>
      await timesStopsTablePage.verifyRowStatus(via2Row, STATUS_CLASSES.WARNING_MARGIN));

    await test.step('Waypoint row (no schedule, no simulation) has neutral status', async () => {
      await timesStopsTablePage.verifyRowStatus(waypointRow, STATUS_CLASSES.NONE);
    });

    await test.step('Destination row has a schedule status (has requested arrival constraint)', async () => {
      await timesStopsTablePage.verifyRowStatus(destRow, STATUS_CLASSES.WARNING_SCHEDULE);
    });
  });
});
