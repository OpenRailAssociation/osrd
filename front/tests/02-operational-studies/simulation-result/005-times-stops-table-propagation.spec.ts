import {
  DESTINATION_DEPARTURE_REEDIT,
  DESTINATION_DEPARTURE_SEED,
  PROPAGATION_ARRIVAL_AT_THIS_WAYPOINT,
  PROPAGATION_ARRIVAL_FROM_DEPARTURE,
  PROPAGATION_ARRIVAL_SHIFT_ALL,
  PROPAGATION_ARRIVAL_TO_DESTINATION,
  PROPAGATION_DEPARTURE_AT_THIS_WAYPOINT,
  PROPAGATION_DEPARTURE_FROM_DEPARTURE,
  PROPAGATION_DEPARTURE_SHIFT_ALL,
  PROPAGATION_DEPARTURE_TO_DESTINATION,
  PROPAGATION_SEED_ARRIVAL_VIA_A,
  PROPAGATION_SEED_DEPARTURE_VIA_A,
  PROPAGATION_SEED_DEPARTURE_VIA_B,
  REQUESTED_MARGIN_DEPARTURE,
  ROW_INDEX_ORIGIN,
  ROW_INDEX_DESTINATION,
  ROW_INDEX_VIA_A,
  ROW_INDEX_VIA_B,
  SCENARIO_NAME_PREFIX,
  myTrain,
} from '../../assets/operation-studies/simulation-result/times-stops-table-const';
import test from '../../page-object-fixture';
import setupScenarioFixture from '../../scenario-fixture';

const OCCURRENCE_INDEX = 0;

test.describe('Times Stops Table — Time propagation', { tag: ['@op', '@times-stops'] }, () => {
  setupScenarioFixture({
    scenarioNamePrefix: SCENARIO_NAME_PREFIX,
    trains: myTrain,
  });

  test.beforeEach('Wait for the times-stops table', async ({ scenarioTimetableSection }) => {
    await scenarioTimetableSection.enableOnlyTimesStopsTable();
    await scenarioTimetableSection.verifyTimesStopsDataSheetVisibility();
  });

  test('Time-propagation menu coherence, on both the arrival and departure columns', async ({
    timesStopsTablePage,
    scenarioTimetableSection,
    pacedTrainSection,
  }) => {
    const originRow = timesStopsTablePage.getRow(ROW_INDEX_ORIGIN);
    const viaARow = timesStopsTablePage.getRow(ROW_INDEX_VIA_A);
    const viaBRow = timesStopsTablePage.getRow(ROW_INDEX_VIA_B);
    const destRow = timesStopsTablePage.getRow(ROW_INDEX_DESTINATION);

    // The timetable's occurrence row surfaces the whole train's departure (origin) and
    // arrival (destination) times, used below to confirm propagation is reflected there too.
    await scenarioTimetableSection.setTrainListVisible(false);
    await pacedTrainSection.expandPacedTrainOccurrenceList(0);

    await test.step('Requested departure equals requested arrival plus stop duration on load', async () => {
      await timesStopsTablePage.verifyDepartureMatchesArrivalPlusStopDuration(viaBRow);
    });

    await test.step('Requested arrival, plain edit on via A seeds the propagation chain', async () => {
      const viaAComputedArrivalBefore = await timesStopsTablePage.getComputedArrivalText(viaARow);

      await timesStopsTablePage.editRequestedArrival(viaARow, PROPAGATION_SEED_ARRIVAL_VIA_A);
      await timesStopsTablePage.verifyRequestedArrivalValue(
        viaARow,
        PROPAGATION_SEED_ARRIVAL_VIA_A
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyComputedArrivalChanged(viaARow, viaAComputedArrivalBefore);
    });

    await test.step('Propagation menu is hidden until a cell with an existing value is re-edited', async () => {
      await timesStopsTablePage.verifyPropagationMenuHidden();
    });

    await test.step('Arrival propagation, "apply to this waypoint" only moves the edited row', async () => {
      const originArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(originRow);
      const viaBArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(viaBRow);
      const originComputedArrivalBefore =
        await timesStopsTablePage.getComputedArrivalText(originRow);
      const viaBComputedArrivalBefore = await timesStopsTablePage.getComputedArrivalText(viaBRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);
      const occurrenceArrivalBefore =
        await pacedTrainSection.getOccurrenceArrivalTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedArrivalWithPropagation(
        viaARow,
        PROPAGATION_ARRIVAL_AT_THIS_WAYPOINT,
        'atThisWaypoint'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedArrivalValue(
        viaARow,
        PROPAGATION_ARRIVAL_AT_THIS_WAYPOINT
      );
      await timesStopsTablePage.verifyRequestedArrivalUnchanged(originRow, originArrivalBefore);
      await timesStopsTablePage.verifyRequestedArrivalUnchanged(viaBRow, viaBArrivalBefore);

      // Origin and via B are untouched by this mode, so their computed times and the
      // whole train's timetable occurrence (departure/arrival) stay unchanged too.
      await timesStopsTablePage.verifyComputedArrivalUnchanged(
        originRow,
        originComputedArrivalBefore
      );
      await timesStopsTablePage.verifyComputedArrivalUnchanged(viaBRow, viaBComputedArrivalBefore);
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeUnchanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceArrivalTimeUnchanged(
        OCCURRENCE_INDEX,
        occurrenceArrivalBefore
      );
    });

    await test.step('Arrival propagation, "shift entire train path" shifts every row by the same delta', async () => {
      const originArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(originRow);
      const viaBArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(viaBRow);
      const originComputedArrivalBefore =
        await timesStopsTablePage.getComputedArrivalText(originRow);
      const viaBComputedArrivalBefore = await timesStopsTablePage.getComputedArrivalText(viaBRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);
      const occurrenceArrivalBefore =
        await pacedTrainSection.getOccurrenceArrivalTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedArrivalWithPropagation(
        viaARow,
        PROPAGATION_ARRIVAL_SHIFT_ALL,
        'shiftAllWaypoints'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedArrivalShiftedBy(
        originRow,
        originArrivalBefore,
        PROPAGATION_ARRIVAL_AT_THIS_WAYPOINT,
        PROPAGATION_ARRIVAL_SHIFT_ALL
      );
      await timesStopsTablePage.verifyRequestedArrivalShiftedBy(
        viaBRow,
        viaBArrivalBefore,
        PROPAGATION_ARRIVAL_AT_THIS_WAYPOINT,
        PROPAGATION_ARRIVAL_SHIFT_ALL
      );

      // Every row shifts here, so its computed time and the timetable occurrence move too.
      await timesStopsTablePage.verifyComputedArrivalChanged(
        originRow,
        originComputedArrivalBefore
      );
      await timesStopsTablePage.verifyComputedArrivalChanged(viaBRow, viaBComputedArrivalBefore);
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeChanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceArrivalTimeChanged(
        OCCURRENCE_INDEX,
        occurrenceArrivalBefore
      );
    });

    await test.step('Arrival propagation, "propagate to destination" only shifts this row and what follows', async () => {
      const originArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(originRow);
      const viaBArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(viaBRow);
      const originComputedArrivalBefore =
        await timesStopsTablePage.getComputedArrivalText(originRow);
      const viaBComputedArrivalBefore = await timesStopsTablePage.getComputedArrivalText(viaBRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);
      const occurrenceArrivalBefore =
        await pacedTrainSection.getOccurrenceArrivalTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedArrivalWithPropagation(
        viaARow,
        PROPAGATION_ARRIVAL_TO_DESTINATION,
        'toDestination'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedArrivalUnchanged(originRow, originArrivalBefore);
      await timesStopsTablePage.verifyRequestedArrivalShiftedBy(
        viaBRow,
        viaBArrivalBefore,
        PROPAGATION_ARRIVAL_SHIFT_ALL,
        PROPAGATION_ARRIVAL_TO_DESTINATION
      );

      // Origin precedes the edited row, so it (and the occurrence's departure) stays put,
      // while via B and the occurrence's arrival follow the shift.
      await timesStopsTablePage.verifyComputedArrivalUnchanged(
        originRow,
        originComputedArrivalBefore
      );
      await timesStopsTablePage.verifyComputedArrivalChanged(viaBRow, viaBComputedArrivalBefore);
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeUnchanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceArrivalTimeChanged(
        OCCURRENCE_INDEX,
        occurrenceArrivalBefore
      );
    });

    await test.step('Arrival propagation, "propagate from departure" only shifts this row and what precedes', async () => {
      const originArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(originRow);
      const viaBArrivalBefore = await timesStopsTablePage.getRequestedArrivalValue(viaBRow);
      const originComputedArrivalBefore =
        await timesStopsTablePage.getComputedArrivalText(originRow);
      const viaBComputedArrivalBefore = await timesStopsTablePage.getComputedArrivalText(viaBRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);
      const occurrenceArrivalBefore =
        await pacedTrainSection.getOccurrenceArrivalTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedArrivalWithPropagation(
        viaARow,
        PROPAGATION_ARRIVAL_FROM_DEPARTURE,
        'fromDeparture'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedArrivalShiftedBy(
        originRow,
        originArrivalBefore,
        PROPAGATION_ARRIVAL_TO_DESTINATION,
        PROPAGATION_ARRIVAL_FROM_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedArrivalUnchanged(viaBRow, viaBArrivalBefore);

      // Origin (and the occurrence's departure) follows the shift here, while via B
      // (and the occurrence's arrival) is downstream of the edited row and stays put.
      await timesStopsTablePage.verifyComputedArrivalChanged(
        originRow,
        originComputedArrivalBefore
      );
      await timesStopsTablePage.verifyComputedArrivalUnchanged(viaBRow, viaBComputedArrivalBefore);
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeChanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceArrivalTimeUnchanged(
        OCCURRENCE_INDEX,
        occurrenceArrivalBefore
      );
    });

    await test.step('Requested departure, plain edits seed the departure propagation chain', async () => {
      await timesStopsTablePage.editRequestedDeparture(viaARow, PROPAGATION_SEED_DEPARTURE_VIA_A);
      await timesStopsTablePage.verifyRequestedDepartureValue(
        viaARow,
        PROPAGATION_SEED_DEPARTURE_VIA_A
      );

      await timesStopsTablePage.editRequestedDeparture(destRow, DESTINATION_DEPARTURE_SEED);
      await timesStopsTablePage.verifyRequestedDepartureValue(destRow, DESTINATION_DEPARTURE_SEED);

      await timesStopsTablePage.editRequestedDeparture(viaBRow, PROPAGATION_SEED_DEPARTURE_VIA_B);
      await timesStopsTablePage.verifyRequestedDepartureValue(
        viaBRow,
        PROPAGATION_SEED_DEPARTURE_VIA_B
      );
      await timesStopsTablePage.waitForSimulation();

      // These seed values put the path out of chronological order (destination's departure
      // lands before via B's, once past midnight), so the schedule can no longer be honored:
      // computed times clear out and the timetable occurrence is flagged invalid.
      await timesStopsTablePage.verifyComputedArrivalEmpty(viaARow);
      await timesStopsTablePage.verifyComputedArrivalEmpty(viaBRow);
      await timesStopsTablePage.verifyComputedArrivalEmpty(destRow);
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceInvalid(OCCURRENCE_INDEX, true);
      await pacedTrainSection.verifyOccurrenceArrivalTimeEmpty(OCCURRENCE_INDEX);
    });

    await test.step('Departure propagation, "apply to this waypoint" only moves the edited row', async () => {
      const viaADepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(viaARow);
      const destDepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(destRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedDepartureWithPropagation(
        viaBRow,
        PROPAGATION_DEPARTURE_AT_THIS_WAYPOINT,
        'atThisWaypoint'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedDepartureValue(
        viaBRow,
        PROPAGATION_DEPARTURE_AT_THIS_WAYPOINT
      );
      await timesStopsTablePage.verifyRequestedDepartureUnchanged(viaARow, viaADepartureBefore);
      await timesStopsTablePage.verifyRequestedDepartureUnchanged(destRow, destDepartureBefore);

      // This mode doesn't touch origin, so the occurrence's departure time stays put and
      // the schedule (and its margins) remains invalid from the previous step.
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeUnchanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceInvalid(OCCURRENCE_INDEX, true);
    });

    await test.step('Departure propagation, "shift entire train path" shifts every row by the same delta', async () => {
      const viaADepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(viaARow);
      const destDepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(destRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedDepartureWithPropagation(
        viaBRow,
        PROPAGATION_DEPARTURE_SHIFT_ALL,
        'shiftAllWaypoints'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedDepartureShiftedBy(
        viaARow,
        viaADepartureBefore,
        PROPAGATION_DEPARTURE_AT_THIS_WAYPOINT,
        PROPAGATION_DEPARTURE_SHIFT_ALL
      );
      await timesStopsTablePage.verifyRequestedDepartureShiftedBy(
        destRow,
        destDepartureBefore,
        PROPAGATION_DEPARTURE_AT_THIS_WAYPOINT,
        PROPAGATION_DEPARTURE_SHIFT_ALL
      );

      // Shifting the whole path also pulls origin's (unedited) arrival along with it, so
      // the occurrence's departure time moves even though origin isn't directly edited.
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeChanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceInvalid(OCCURRENCE_INDEX, true);
    });

    await test.step('Departure propagation, "propagate to destination" only shifts this row and what follows', async () => {
      const viaADepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(viaARow);
      const destDepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(destRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedDepartureWithPropagation(
        viaBRow,
        PROPAGATION_DEPARTURE_TO_DESTINATION,
        'toDestination'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedDepartureUnchanged(viaARow, viaADepartureBefore);
      await timesStopsTablePage.verifyRequestedDepartureShiftedBy(
        destRow,
        destDepartureBefore,
        PROPAGATION_DEPARTURE_SHIFT_ALL,
        PROPAGATION_DEPARTURE_TO_DESTINATION
      );

      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeUnchanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceInvalid(OCCURRENCE_INDEX, true);
    });

    await test.step('Departure propagation, "propagate from departure" only shifts this row and what precedes', async () => {
      const viaADepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(viaARow);
      const destDepartureBefore = await timesStopsTablePage.getRequestedDepartureValue(destRow);
      const occurrenceStartBefore =
        await pacedTrainSection.getOccurrenceStartTime(OCCURRENCE_INDEX);

      await timesStopsTablePage.editRequestedDepartureWithPropagation(
        viaBRow,
        PROPAGATION_DEPARTURE_FROM_DEPARTURE,
        'fromDeparture'
      );
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.verifyRequestedDepartureShiftedBy(
        viaARow,
        viaADepartureBefore,
        PROPAGATION_DEPARTURE_TO_DESTINATION,
        PROPAGATION_DEPARTURE_FROM_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedDepartureUnchanged(destRow, destDepartureBefore);

      // "fromDeparture" pulls origin's arrival along with via A, so the occurrence's
      // departure time moves again here.
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        originRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await timesStopsTablePage.verifyRequestedTheoreticalMarginText(
        viaBRow,
        REQUESTED_MARGIN_DEPARTURE
      );
      await pacedTrainSection.verifyOccurrenceStartTimeChanged(
        OCCURRENCE_INDEX,
        occurrenceStartBefore
      );
      await pacedTrainSection.verifyOccurrenceInvalid(OCCURRENCE_INDEX, true);
    });

    // BUG
    await test.step('Propagation menu, disable-state bug on requested departure at the last row', async () => {
      await timesStopsTablePage.editRequestedDeparture(destRow, DESTINATION_DEPARTURE_SEED);
      await timesStopsTablePage.verifyRequestedDepartureValue(destRow, DESTINATION_DEPARTURE_SEED);
      await timesStopsTablePage.waitForSimulation();

      await timesStopsTablePage.openRequestedDeparturePropagationMenu(
        destRow,
        DESTINATION_DEPARTURE_REEDIT
      );
      await timesStopsTablePage.verifyPropagationMenuVisible();
      await timesStopsTablePage.verifyPropagationModeDisabled('toDestination', false);
      await timesStopsTablePage.selectPropagationMode('atThisWaypoint');
      await timesStopsTablePage.waitForSimulation();
    });
  });
});
